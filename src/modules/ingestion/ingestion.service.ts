import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { verifyWebhookSignature } from '../../common/crypto';
import type { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { EndpointService } from '../endpoints/endpoint.service';

export interface IngestResult {
  eventId: string;
  status: 'accepted' | 'duplicate';
  receivedAt: Date;
}

interface ExistingEventRow {
  id: string;
  created_at: Date;
  status: string;
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly endpointService: EndpointService,
  ) {}

  /**
   * High-throughput webhook ingestion endpoint.
   * Performs signature verification, idempotency deduplication, and transactional outbox persistence.
   */
  async ingestWebhook(
    endpointId: string,
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    parsedBody: unknown,
  ): Promise<IngestResult> {
    // 1. Resolve endpoint and decrypt secret using trusted SECURITY DEFINER helper
    const endpoint = await this.endpointService.getEndpointForIngestion(endpointId);
    if (!endpoint) {
      throw new NotFoundException(`Endpoint '${endpointId}' not found or inactive.`);
    }

    // 2. Signature verification
    const sigHeader =
      (headers['x-relayforge-signature'] as string) ||
      (headers['x-signature-256'] as string) ||
      (headers['x-hub-signature-256'] as string);

    if (sigHeader) {
      const isValid = verifyWebhookSignature(rawBody, sigHeader, endpoint.signingSecret);
      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature.');
      }
    }

    // 3. Extract Idempotency Key
    const idempotencyKey =
      (headers['x-idempotency-key'] as string) ||
      (headers['idempotency-key'] as string) ||
      ((parsedBody as Record<string, unknown>)?.idempotency_key as string) ||
      ((parsedBody as Record<string, unknown>)?.id as string) ||
      null;

    // Check for existing event if idempotency key is supplied via trusted SECURITY DEFINER helper
    if (idempotencyKey) {
      const existing = await this.database.client.$queryRaw<ExistingEventRow[]>`
        SELECT id, created_at, status
        FROM find_event_by_idempotency(${endpoint.id}::uuid, ${idempotencyKey})
      `;

      const first = existing && existing.length > 0 ? existing[0] : undefined;
      if (first) {
        return {
          eventId: first.id,
          status: 'duplicate',
          receivedAt: first.created_at,
        };
      }
    }

    // 4. Determine event type
    const eventType =
      (headers['x-event-type'] as string) ||
      ((parsedBody as Record<string, unknown>)?.type as string) ||
      ((parsedBody as Record<string, unknown>)?.event as string) ||
      'webhook.received';

    // 5. Transactional Outbox Pattern: Atomic persistence of event + outbox message
    const eventId = randomUUID();
    const outboxId = randomUUID();
    const payloadJson: Prisma.InputJsonValue =
      typeof parsedBody === 'object' && parsedBody !== null
        ? parsedBody
        : { raw: String(parsedBody) };

    try {
      return await this.database.client.$transaction(async (tx) => {
        // Set tenant context for PostgreSQL RLS policies
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${endpoint.organizationId}, true)`;

        const event = await tx.event.create({
          data: {
            id: eventId,
            organizationId: endpoint.organizationId,
            endpointId: endpoint.id,
            idempotencyKey,
            eventType,
            payload: payloadJson,
            headers: {
              'content-type': headers['content-type'] as string,
              'user-agent': headers['user-agent'] as string,
              'x-event-type': eventType,
            },
            status: 'RECEIVED',
          },
        });

        await tx.outboxMessage.create({
          data: {
            id: outboxId,
            eventId: event.id,
            organizationId: endpoint.organizationId,
            channel: 'events',
            payload: payloadJson,
            status: 'PENDING',
          },
        });

        return {
          eventId: event.id,
          status: 'accepted',
          receivedAt: event.createdAt,
        };
      });
    } catch (err: unknown) {
      // Handle concurrent duplicate insertion under race conditions
      if (
        idempotencyKey &&
        (err as { code?: string })?.code === 'P2002' // Prisma unique constraint violation
      ) {
        const existing = await this.database.client.$queryRaw<ExistingEventRow[]>`
          SELECT id, created_at, status
          FROM find_event_by_idempotency(${endpoint.id}::uuid, ${idempotencyKey})
        `;

        const first = existing && existing.length > 0 ? existing[0] : undefined;
        if (first) {
          return {
            eventId: first.id,
            status: 'duplicate',
            receivedAt: first.created_at,
          };
        }
      }

      throw err;
    }
  }

  /**
   * Retrieves events for an organization (for inspection & audit in UI).
   */
  async listEvents(organizationId: string, endpointId?: string, limit = 50) {
    return this.database.client.event.findMany({
      where: {
        organizationId,
        ...(endpointId ? { endpointId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        endpointId: true,
        eventType: true,
        idempotencyKey: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
