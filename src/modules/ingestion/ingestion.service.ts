import {
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { computeHmacSignature, verifyWebhookSignature } from '../../common/crypto';
import type { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { EndpointService } from '../endpoints/endpoint.service';
import { EventStreamService } from '../observability/event-stream.service';

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
    @Optional() private readonly eventStream?: EventStreamService,
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

        // Check for active workflow configured for this endpoint
        const activeWorkflows = await tx.$queryRaw<Array<{ workflow_id: string; org_id: string; version_id: string }>>`
          SELECT workflow_id, org_id, version_id
          FROM get_active_workflow_for_endpoint(${endpoint.id}::uuid)
        `;

        if (activeWorkflows.length > 0 && activeWorkflows[0]?.version_id) {
          const wf = activeWorkflows[0];
          const workflowExecution = await tx.workflowExecution.create({
            data: {
              organizationId: endpoint.organizationId,
              workflowId: wf.workflow_id,
              workflowVersionId: wf.version_id,
              eventId: event.id,
              status: 'QUEUED',
              currentStep: 0,
            },
          });

          await tx.outboxMessage.create({
            data: {
              id: outboxId,
              eventId: event.id,
              workflowExecutionId: workflowExecution.id,
              organizationId: endpoint.organizationId,
              channel: 'workflow',
              payload: payloadJson,
              status: 'PENDING',
            },
          });
        } else {
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
        }

        const result: IngestResult = {
          eventId: event.id,
          status: 'accepted',
          receivedAt: event.createdAt,
        };

        if (this.eventStream) {
          void this.eventStream.publishEvent({
            type: 'webhook.ingested',
            organizationId: endpoint.organizationId,
            timestamp: event.createdAt.toISOString(),
            payload: {
              eventId: event.id,
              endpointId: endpoint.id,
              eventType: event.eventType,
              idempotencyKey: event.idempotencyKey,
            },
          });
        }

        return result;
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
   * Simulates an inbound webhook from the authenticated management console.
   * Cryptographically signs the payload with the endpoint's real secret,
   * passes it into the transactional outbox pipeline, and returns the execution trace.
   */
  async simulateWebhook(
    endpointId: string,
    userId: string,
    input: { eventType?: string; idempotencyKey?: string; payload?: unknown },
  ) {
    const endpoint = await this.endpointService.getEndpointForIngestion(endpointId);
    if (!endpoint) {
      throw new NotFoundException(`Endpoint '${endpointId}' not found or inactive.`);
    }

    // Verify user belongs to the endpoint's organization inside tenant context
    const membership = await this.database.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${endpoint.organizationId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      return tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: endpoint.organizationId,
            userId,
          },
        },
      });
    });
    if (!membership) {
      throw new UnauthorizedException('You do not have access to this organization.');
    }

    const payload = input.payload || {
      event: input.eventType || 'test.simulated',
      source: 'RelayForge Ingest Console',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Hello from RelayForge Inbound Webhook Simulator!',
        status: 'simulated_ok',
      },
    };

    const rawBody = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
    const signature = `sha256=${computeHmacSignature(rawBody, endpoint.signingSecret)}`;

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'RelayForge-Simulator/1.0',
      'x-relayforge-signature': signature,
      'x-event-type': input.eventType || 'test.simulated',
    };
    if (input.idempotencyKey) {
      headers['x-idempotency-key'] = input.idempotencyKey;
    }

    const result = await this.ingestWebhook(endpointId, rawBody, headers, payload);

    return {
      success: true,
      endpointId,
      endpointName: endpoint.name,
      eventId: result.eventId,
      status: result.status,
      receivedAt: result.receivedAt,
      signature,
      headers,
      payload,
    };
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
