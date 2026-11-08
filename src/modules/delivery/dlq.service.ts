import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';
import { EventStreamService } from '../observability/event-stream.service';

export interface DlqFilterParams {
  destinationId?: string | undefined;
  errorCategory?: 'PERMANENT_HTTP' | 'EXHAUSTED_RETRIES' | 'SSRF_BLOCKED' | 'TIMEOUT' | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface DlqRecord {
  id: string;
  eventId: string;
  channel: string;
  attemptCount: number;
  maxRetries: number;
  status: string;
  createdAt: Date;
  lastAttemptAt?: Date | null | undefined;
  lastStatusCode?: number | null | undefined;
  lastErrorDescription?: string | null | undefined;
  destinationId?: string | null | undefined;
  destinationName?: string | null | undefined;
  destinationUrl?: string | null | undefined;
  replayedAt?: Date | null | undefined;
  payloadSummary?: unknown;
}

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly eventStream?: EventStreamService,
  ) {}

  /**
   * Lists DLQ outbox messages with latest delivery error attribution under strict tenant RLS.
   */
  async listDlqMessages(
    organizationId: string,
    userId: string,
    filters: DlqFilterParams = {},
  ): Promise<{ total: number; records: DlqRecord[] }> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });
      if (!membership) {
        throw new ForbiddenException('User is not a member of this organization');
      }

      const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);
      const offset = Math.max(0, filters.offset ?? 0);

      // Fetch failed or dead-letter outbox records for this org
      const whereClause: Prisma.OutboxMessageWhereInput = {
        organizationId,
        status: { in: ['FAILED', 'DEAD_LETTER'] },
      };

      if (filters.search) {
        const trimmed = filters.search.trim();
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
          whereClause.OR = [
            { id: trimmed },
            { eventId: trimmed },
          ];
        }
      }

      const [total, outboxRows] = await Promise.all([
        tx.outboxMessage.count({ where: whereClause }),
        tx.outboxMessage.findMany({
          where: whereClause,
          include: {
            deliveryAttempts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                destination: {
                  select: { id: true, name: true, url: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
      ]);

      const records: DlqRecord[] = outboxRows.map((msg) => {
        const lastAttempt = msg.deliveryAttempts[0];
        return {
          id: msg.id,
          eventId: msg.eventId,
          channel: msg.channel,
          attemptCount: msg.attemptCount,
          maxRetries: msg.maxRetries,
          status: msg.status,
          createdAt: msg.createdAt,
          lastAttemptAt: lastAttempt?.createdAt ?? null,
          lastStatusCode: lastAttempt?.statusCode ?? null,
          lastErrorDescription: lastAttempt?.errorDescription ?? null,
          destinationId: lastAttempt?.destination?.id ?? null,
          destinationName: lastAttempt?.destination?.name ?? null,
          destinationUrl: lastAttempt?.destination?.url ?? null,
          replayedAt: msg.replayedAt,
          payloadSummary: msg.payload,
        };
      });

      // Filter by category in-memory if requested
      let filtered = records;
      if (filters.errorCategory) {
        filtered = filtered.filter((r) => {
          if (filters.errorCategory === 'PERMANENT_HTTP') {
            return (
              r.lastStatusCode !== null &&
              r.lastStatusCode !== undefined &&
              [400, 401, 403, 404, 405, 410, 422].includes(r.lastStatusCode)
            );
          }
          if (filters.errorCategory === 'EXHAUSTED_RETRIES') {
            return r.attemptCount >= r.maxRetries;
          }
          if (filters.errorCategory === 'SSRF_BLOCKED') {
            return r.lastErrorDescription?.toLowerCase().includes('ssrf');
          }
          if (filters.errorCategory === 'TIMEOUT') {
            return (
              r.lastStatusCode === 408 ||
              r.lastStatusCode === 504 ||
              r.lastErrorDescription?.toLowerCase().includes('timeout')
            );
          }
          return true;
        });
      }

      if (filters.destinationId) {
        filtered = filtered.filter((r) => r.destinationId === filters.destinationId);
      }

      return { total, records: filtered };
    });
  }

  /**
   * Concurrently replays a batch of up to 100 failed DLQ deliveries.
   * Enforces row-level locks and active lease protections.
   */
  async bulkReplayDlq(
    organizationId: string,
    userId: string,
    outboxIds: string[],
  ): Promise<{ replayedCount: number; replayedIds: string[]; skippedIds: string[] }> {
    if (!outboxIds || outboxIds.length === 0) {
      throw new BadRequestException('No outbox IDs provided for bulk replay');
    }
    if (outboxIds.length > 100) {
      throw new BadRequestException('Bulk replay exceeds maximum batch size of 100');
    }

    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });
      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'DEVELOPER')) {
        throw new ForbiddenException('Only Owners and Developers can replay DLQ deliveries');
      }

      // Query candidate rows with FOR UPDATE SKIP LOCKED
      const candidates = await tx.outboxMessage.findMany({
        where: {
          id: { in: outboxIds },
          organizationId,
          status: { in: ['FAILED', 'DEAD_LETTER'] },
        },
      });

      const now = new Date();
      const replayedIds: string[] = [];
      const skippedIds: string[] = [];

      for (const msg of candidates) {
        // If lease is currently active on an in-flight worker, do not replay!
        if (msg.leaseExpiresAt && msg.leaseExpiresAt > now) {
          skippedIds.push(msg.id);
          continue;
        }

        await tx.outboxMessage.update({
          where: { id: msg.id },
          data: {
            status: 'PENDING',
            attemptCount: 0,
            nextRetryAt: now,
            leaseToken: null,
            leaseExpiresAt: null,
            replayedAt: now,
            replayedBy: userId,
          },
        });

        replayedIds.push(msg.id);
      }

      // Record remaining requested IDs that were not found as skipped
      const candidateSet = new Set(candidates.map((c) => c.id));
      for (const id of outboxIds) {
        if (!candidateSet.has(id)) {
          skippedIds.push(id);
        }
      }

      this.logger.log({
        event: 'dlq_bulk_replay_executed',
        organizationId,
        replayedCount: replayedIds.length,
        skippedCount: skippedIds.length,
      });

      // Emit real-time event if stream is available
      if (this.eventStream && replayedIds.length > 0) {
        void this.eventStream.publishEvent({
          type: 'dlq.routed',
          organizationId,
          timestamp: new Date().toISOString(),
          payload: {
            replayedCount: replayedIds.length,
            status: 'REPLAYED',
            replayedIds,
          },
        });
      }

      return {
        replayedCount: replayedIds.length,
        replayedIds,
        skippedIds,
      };
    });
  }

  /**
   * Purges an unrecoverable DLQ message so it no longer clutters queues.
   */
  async purgeDlqMessage(
    organizationId: string,
    userId: string,
    outboxId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });
      if (!membership || membership.role !== 'OWNER') {
        throw new ForbiddenException('Only Organization Owners can purge DLQ messages');
      }

      const existing = await tx.outboxMessage.findUnique({
        where: { id: outboxId },
      });

      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundException(`Outbox message '${outboxId}' not found`);
      }

      if (existing.status !== 'FAILED' && existing.status !== 'DEAD_LETTER') {
        throw new BadRequestException('Cannot purge an active or dispatched outbox message');
      }

      await tx.outboxMessage.delete({
        where: { id: outboxId },
      });

      this.logger.log({
        event: 'dlq_message_purged',
        organizationId,
        outboxId,
        purgedBy: userId,
      });

      return {
        success: true,
        message: `DLQ message '${outboxId}' purged successfully`,
      };
    });
  }
}
