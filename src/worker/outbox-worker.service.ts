import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../modules/database/database.service';
import { DeliveryService } from '../modules/delivery/delivery.service';
import { evaluateRetry } from '../modules/delivery/retry-policy';
import { safeError } from '../modules/observability/logging';

interface ClaimedOutboxRow {
  id: string;
  event_id: string;
  org_id: string;
  channel: string;
  payload: unknown;
  status: string;
  attempt_count: number;
  created_at: Date;
  event_type: string;
  max_retries: number;
}

interface ActiveDestinationRow {
  id: string;
  org_id: string;
  name: string;
  url: string;
  http_method: string;
  headers: Record<string, string> | null;
  rate_limit_per_second: number;
  timeout_ms: number;
  is_active: boolean;
}

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private sweepTimer: NodeJS.Timeout | undefined;
  private staleRecoveryTimer: NodeJS.Timeout | undefined;
  private isProcessing = false;
  private isRunning = true;

  constructor(
    private readonly database: DatabaseService,
    private readonly deliveryService: DeliveryService,
  ) {}

  onModuleInit(): void {
    this.isRunning = true;

    // Start background polling sweep every 1000ms
    this.sweepTimer = setInterval(() => {
      void this.sweepPendingOutbox();
    }, 1000);

    // Start crash recovery stale lease sweeper every 15000ms
    this.staleRecoveryTimer = setInterval(() => {
      void this.sweepStaleLeases();
    }, 15000);

    // Initial immediate sweeps
    void this.sweepPendingOutbox();
    void this.sweepStaleLeases();
    this.logger.log({ event: 'outbox_worker_started', pollIntervalMs: 1000 });
  }

  onModuleDestroy(): void {
    this.isRunning = false;
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    if (this.staleRecoveryTimer) {
      clearInterval(this.staleRecoveryTimer);
      this.staleRecoveryTimer = undefined;
    }
  }

  /**
   * Concurrently claims and dispatches pending transactional outbox messages.
   * Uses FOR UPDATE SKIP LOCKED via claim_pending_outbox_messages to prevent
   * double-delivery across multi-instance worker deployments.
   */
  async sweepPendingOutbox(): Promise<number> {
    if (!this.isRunning || this.isProcessing) return 0;
    this.isProcessing = true;

    let processedCount = 0;
    try {
      const claimedMessages = await this.database.client.$queryRaw<ClaimedOutboxRow[]>`
        SELECT id, event_id, org_id, channel, payload, status, attempt_count, created_at, event_type, max_retries
        FROM claim_pending_outbox_messages(25, 30)
      `;

      if (!claimedMessages || claimedMessages.length === 0) {
        return 0;
      }

      processedCount = claimedMessages.length;
      for (const msg of claimedMessages) {
        await this.processOutboxMessage(msg);
      }
    } catch (err: unknown) {
      this.logger.error({
        event: 'outbox_sweep_error',
        error: safeError(err),
      });
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  /**
   * Reclaims stale outbox message leases in case of worker crashes or ungraceful terminations.
   */
  async sweepStaleLeases(): Promise<number> {
    try {
      const res = await this.database.client.$queryRaw<{ reclaim_stale_outbox_leases: number }[]>`
        SELECT reclaim_stale_outbox_leases()
      `;
      const count = res?.[0]?.reclaim_stale_outbox_leases ?? 0;
      if (count > 0) {
        this.logger.warn({ event: 'stale_leases_reclaimed', count });
      }
      return count;
    } catch (err: unknown) {
      this.logger.error({ event: 'stale_lease_recovery_error', error: safeError(err) });
      return 0;
    }
  }

  private async processOutboxMessage(msg: ClaimedOutboxRow): Promise<void> {
    try {
      // 1. Fetch active destinations for this tenant
      const destinations = await this.database.client.$queryRaw<ActiveDestinationRow[]>`
        SELECT id, org_id, name, url, http_method, headers, rate_limit_per_second, timeout_ms, is_active
        FROM get_active_destinations_for_org(${msg.org_id}::uuid)
      `;

      const eventType = msg.event_type || 'webhook.event';

      // If no active destinations exist, mark outbox dispatched and event completed
      if (!destinations || destinations.length === 0) {
        await this.database.client.$executeRaw`
          SELECT complete_outbox_dispatch(${msg.id}::uuid, ${msg.event_id}::uuid, 'DISPATCHED', 'COMPLETED')
        `;
        return;
      }

      // 3. Deliver to each destination target
      let anySucceeded = false;
      let lastStatusCode: number | null = null;
      let lastErrorDescription: string | null = null;

      for (const dest of destinations) {
        const attempt = await this.deliveryService.deliverEventToDestination({
          organizationId: msg.org_id,
          eventId: msg.event_id,
          destination: {
            id: dest.id,
            url: dest.url,
            httpMethod: dest.http_method,
            headers: dest.headers,
            rateLimitPerSecond: dest.rate_limit_per_second,
            timeoutMs: dest.timeout_ms,
          },
          payload: msg.payload,
          eventType,
          outboxMessageId: msg.id,
          attemptNumber: msg.attempt_count,
        });

        if (attempt.status === 'SUCCESS') {
          anySucceeded = true;
        } else {
          lastStatusCode = attempt.statusCode;
          lastErrorDescription = attempt.errorDescription;
        }
      }

      // 4. Update status or schedule retry / dead-letter
      if (anySucceeded) {
        await this.database.client.$executeRaw`
          SELECT complete_outbox_dispatch(${msg.id}::uuid, ${msg.event_id}::uuid, 'DISPATCHED', 'COMPLETED')
        `;
      } else {
        const evalResult = evaluateRetry({
          attemptCount: msg.attempt_count,
          maxRetries: msg.max_retries ?? 5,
          statusCode: lastStatusCode,
          errorDescription: lastErrorDescription,
        });

        if (evalResult.shouldRetry && evalResult.nextRetryAt) {
          await this.database.client.$executeRaw`
            SELECT schedule_outbox_retry(${msg.id}::uuid, ${msg.event_id}::uuid, ${evalResult.nextRetryAt}::timestamptz, false)
          `;
          this.logger.log({
            event: 'delivery_retry_scheduled',
            outboxId: msg.id,
            attemptCount: msg.attempt_count,
            delayMs: evalResult.delayMs,
            nextRetryAt: evalResult.nextRetryAt.toISOString(),
          });
        } else {
          await this.database.client.$executeRaw`
            SELECT schedule_outbox_retry(${msg.id}::uuid, ${msg.event_id}::uuid, NOW(), true)
          `;
          this.logger.warn({
            event: 'delivery_dead_lettered',
            outboxId: msg.id,
            attemptCount: msg.attempt_count,
            reason: evalResult.reason,
            statusCode: lastStatusCode,
            error: lastErrorDescription,
          });
        }
      }
    } catch (err: unknown) {
      this.logger.error({
        event: 'process_outbox_message_failed',
        outboxId: msg.id,
        error: safeError(err),
      });

      const evalResult = evaluateRetry({
        attemptCount: msg.attempt_count,
        maxRetries: msg.max_retries ?? 5,
        statusCode: null,
        errorDescription: err instanceof Error ? err.message : 'Unknown dispatch error',
      });

      if (evalResult.shouldRetry && evalResult.nextRetryAt) {
        await this.database.client.$executeRaw`
          SELECT schedule_outbox_retry(${msg.id}::uuid, ${msg.event_id}::uuid, ${evalResult.nextRetryAt}::timestamptz, false)
        `;
      } else {
        await this.database.client.$executeRaw`
          SELECT schedule_outbox_retry(${msg.id}::uuid, ${msg.event_id}::uuid, NOW(), true)
        `;
      }
    }
  }
}
