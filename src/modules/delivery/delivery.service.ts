import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { signWebhookPayload } from '../../common/crypto';
import { validateDestinationUrl } from '../../common/security/ssrf.validator';
import type { Prisma } from '../../generated/prisma/client';
import { AuthorizationService } from '../auth/authorization.service';
import { RuntimeConfig } from '../config/config.module';
import { TenantContextService } from '../database/tenant-context.service';

export interface DeliverEventParams {
  organizationId: string;
  eventId: string;
  destination: {
    id: string;
    url: string;
    httpMethod?: string;
    headers?: Record<string, string> | null;
    rateLimitPerSecond?: number;
    timeoutMs?: number;
  };
  payload: unknown;
  eventType: string;
  outboxMessageId?: string;
  attemptNumber?: number;
  signingSecret?: string;
}

export interface DeliveryAttemptRecord {
  id: string;
  organizationId: string;
  eventId: string;
  destinationId: string;
  outboxMessageId: string | null;
  attemptNumber: number;
  status: 'SUCCESS' | 'FAILED';
  statusCode: number | null;
  latencyMs: number;
  requestUrl: string;
  requestMethod: string;
  requestHeaders: Prisma.JsonValue;
  responseHeaders: Prisma.JsonValue | null;
  responseBodyPreview: string | null;
  errorDescription: string | null;
  createdAt: Date;
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly authz: AuthorizationService,
    private readonly config: RuntimeConfig,
  ) {}

  /**
   * Executes HTTP delivery to a destination target with SSRF validation,
   * HMAC signing, latency measurement, and durable attempt record creation.
   */
  async deliverEventToDestination(params: DeliverEventParams): Promise<DeliveryAttemptRecord> {
    const attemptId = randomUUID();
    const bodyStr = typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload);

    // Defense-in-depth: Validate SSRF egress policy at dispatch time
    if (!this.config.values.allowPrivateDestinations) {
      try {
        await validateDestinationUrl(params.destination.url, {
          allowPrivate: this.config.values.allowPrivateDestinations,
        });
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Blocked destination address';
        this.logger.warn({
          event: 'delivery_ssrf_blocked',
          destinationId: params.destination.id,
          url: params.destination.url,
          reason,
        });

        return this.persistAttempt(params.organizationId, {
          id: attemptId,
          organizationId: params.organizationId,
          eventId: params.eventId,
          destinationId: params.destination.id,
          outboxMessageId: params.outboxMessageId ?? null,
          attemptNumber: params.attemptNumber ?? 1,
          status: 'FAILED',
          statusCode: null,
          latencyMs: 0,
          requestUrl: params.destination.url,
          requestMethod: params.destination.httpMethod ?? 'POST',
          requestHeaders: {},
          responseHeaders: null,
          responseBodyPreview: null,
          errorDescription: `SSRF validation failed: ${reason}`,
        });
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signingSecret = params.signingSecret || 'relayforge_webhook_secret';
    const signature = signWebhookPayload(bodyStr, signingSecret, timestamp);

    const requestHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'RelayForge/1.0 (+https://relayforge.dev)',
      'x-relayforge-delivery': attemptId,
      'x-relayforge-event': params.eventType,
      'x-relayforge-timestamp': String(timestamp),
      'x-relayforge-signature': signature,
    };

    // Merge custom destination headers
    if (params.destination.headers && typeof params.destination.headers === 'object') {
      for (const [k, v] of Object.entries(params.destination.headers)) {
        if (typeof v === 'string') {
          requestHeaders[k.toLowerCase()] = v;
        }
      }
    }

    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseHeaders: Record<string, string> | null = null;
    let responseBodyPreview: string | null = null;
    let errorDescription: string | null = null;
    let status: 'SUCCESS' | 'FAILED' = 'FAILED';

    try {
      const timeoutMs = params.destination.timeoutMs ?? 10000;
      const res = await fetch(params.destination.url, {
        method: params.destination.httpMethod ?? 'POST',
        headers: requestHeaders,
        body: bodyStr,
        signal: AbortSignal.timeout(timeoutMs),
      });

      statusCode = res.status;
      const resHeadersObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeadersObj[key] = val;
      });
      responseHeaders = resHeadersObj;

      const rawText = await res.text().catch(() => '');
      responseBodyPreview = rawText.slice(0, 2048);
      status = res.ok ? 'SUCCESS' : 'FAILED';
      if (!res.ok) {
        errorDescription = `HTTP ${res.status}: ${res.statusText || 'Delivery destination rejected webhook'}`;
      }
    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string } | null;
      const isTimeout = errObj?.name === 'TimeoutError' || errObj?.name === 'AbortError';
      errorDescription = isTimeout
        ? `Delivery timed out after ${params.destination.timeoutMs ?? 10000}ms`
        : typeof errObj?.message === 'string'
        ? errObj.message
        : 'Network transport error';
      status = 'FAILED';
    }

    const latencyMs = Date.now() - startTime;

    return this.persistAttempt(params.organizationId, {
      id: attemptId,
      organizationId: params.organizationId,
      eventId: params.eventId,
      destinationId: params.destination.id,
      outboxMessageId: params.outboxMessageId ?? null,
      attemptNumber: params.attemptNumber ?? 1,
      status,
      statusCode,
      latencyMs,
      requestUrl: params.destination.url,
      requestMethod: params.destination.httpMethod ?? 'POST',
      requestHeaders,
      responseHeaders,
      responseBodyPreview,
      errorDescription,
    });
  }

  /**
   * Persists delivery attempt record inside tenant context.
   */
  private async persistAttempt(
    organizationId: string,
    data: {
      id: string;
      organizationId: string;
      eventId: string;
      destinationId: string;
      outboxMessageId: string | null;
      attemptNumber: number;
      status: 'SUCCESS' | 'FAILED';
      statusCode: number | null;
      latencyMs: number;
      requestUrl: string;
      requestMethod: string;
      requestHeaders: Prisma.InputJsonValue;
      responseHeaders: Prisma.InputJsonValue | null;
      responseBodyPreview: string | null;
      errorDescription: string | null;
    },
  ): Promise<DeliveryAttemptRecord> {
    return this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
      const record = await tx.deliveryAttempt.create({
        data: {
          id: data.id,
          organizationId: data.organizationId,
          eventId: data.eventId,
          destinationId: data.destinationId,
          outboxMessageId: data.outboxMessageId,
          attemptNumber: data.attemptNumber,
          status: data.status,
          statusCode: data.statusCode,
          latencyMs: data.latencyMs,
          requestUrl: data.requestUrl,
          requestMethod: data.requestMethod,
          requestHeaders: data.requestHeaders,
          ...(data.responseHeaders !== null ? { responseHeaders: data.responseHeaders } : {}),
          responseBodyPreview: data.responseBodyPreview,
          errorDescription: data.errorDescription,
        },
      });

      return {
        id: record.id,
        organizationId: record.organizationId,
        eventId: record.eventId,
        destinationId: record.destinationId,
        outboxMessageId: record.outboxMessageId,
        attemptNumber: record.attemptNumber,
        status: record.status,
        statusCode: record.statusCode,
        latencyMs: record.latencyMs,
        requestUrl: record.requestUrl,
        requestMethod: record.requestMethod,
        requestHeaders: record.requestHeaders,
        responseHeaders: record.responseHeaders,
        responseBodyPreview: record.responseBodyPreview,
        errorDescription: record.errorDescription,
        createdAt: record.createdAt,
      };
    });
  }

  /**
   * Retrieves paginated delivery attempts for an organization.
   */
  async listDeliveryAttempts(
    organizationId: string,
    userId: string,
    filters?: {
      destinationId?: string;
      eventId?: string;
      status?: 'SUCCESS' | 'FAILED';
      limit?: number;
    },
  ): Promise<DeliveryAttemptRecord[]> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      const where: Prisma.DeliveryAttemptWhereInput = {
        organizationId,
      };

      if (filters?.destinationId) {
        where.destinationId = filters.destinationId;
      }
      if (filters?.eventId) {
        where.eventId = filters.eventId;
      }
      if (filters?.status) {
        where.status = filters.status;
      }

      const records = await tx.deliveryAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ? Math.min(filters.limit, 100) : 50,
      });

      return records.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        eventId: r.eventId,
        destinationId: r.destinationId,
        outboxMessageId: r.outboxMessageId,
        attemptNumber: r.attemptNumber,
        status: r.status,
        statusCode: r.statusCode,
        latencyMs: r.latencyMs,
        requestUrl: r.requestUrl,
        requestMethod: r.requestMethod,
        requestHeaders: r.requestHeaders,
        responseHeaders: r.responseHeaders,
        responseBodyPreview: r.responseBodyPreview,
        errorDescription: r.errorDescription,
        createdAt: r.createdAt,
      }));
    });
  }

  /**
   * Tests destination connectivity by dispatching a synthetic ping event.
   */
  async testDestinationPing(
    organizationId: string,
    userId: string,
    destinationId: string,
  ): Promise<DeliveryAttemptRecord> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      if (!membership) {
        throw new NotFoundException('Organization not found or access denied.');
      }

      if (!this.authz.canManageDestinations(membership.role)) {
        throw new ForbiddenException('Only OWNER or DEVELOPER roles can test destination targets.');
      }

      const destination = await tx.destination.findFirst({
        where: { id: destinationId, organizationId },
      });

      if (!destination) {
        throw new NotFoundException('Destination target not found.');
      }

      // Check if synthetic ping event exists or create one
      const endpoint = await tx.endpoint.findFirst({ where: { organizationId } });
      if (!endpoint) {
        throw new NotFoundException('An ingestion endpoint is required before pinging destinations.');
      }

      const syntheticEvent = await tx.event.create({
        data: {
          organizationId,
          endpointId: endpoint.id,
          eventType: 'relayforge.ping',
          payload: {
            test: true,
            message: 'RelayForge destination connectivity ping',
            timestamp: new Date().toISOString(),
          },
          status: 'COMPLETED',
        },
      });

      return {
        syntheticEvent,
        destination,
      };
    }).then(async ({ syntheticEvent, destination }) => {
      // Execute delivery outside the transaction so HTTP latency and persistAttempt are separate
      return this.deliverEventToDestination({
        organizationId,
        eventId: syntheticEvent.id,
        destination: {
          id: destination.id,
          url: destination.url,
          httpMethod: destination.httpMethod,
          headers: destination.headers as Record<string, string> | null,
          rateLimitPerSecond: destination.rateLimitPerSecond,
          timeoutMs: destination.timeoutMs,
        },
        payload: {
          test: true,
          message: 'RelayForge destination connectivity ping',
          timestamp: new Date().toISOString(),
        },
        eventType: 'relayforge.ping',
        attemptNumber: 1,
      });
    });
  }
}
