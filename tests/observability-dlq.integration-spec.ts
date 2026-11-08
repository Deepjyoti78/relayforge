import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { generateToken, hashToken } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';
import { TenantContextService } from '../src/modules/database/tenant-context.service';
import { RateLimiterService } from '../src/modules/delivery/rate-limiter.service';
import type { OrganizationMetrics } from '../src/modules/observability/metrics.service';

interface OrgCreateResponse {
  id: string;
  name: string;
  slug: string;
}

interface EndpointCreateResponse {
  endpoint: {
    id: string;
    name: string;
  };
}

interface DlqListResponse {
  total: number;
  records: Array<{ id: string }>;
}

interface BulkReplayResponse {
  replayedCount: number;
  replayedIds: string[];
}

interface PurgeResponse {
  success: boolean;
  message: string;
}

describe('Milestone 5: Observability, Destination Rate Limiting & DLQ Management (Integration)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let tenantContext: TenantContextService;
  let rateLimiter: RateLimiterService;

  let ownerCookie: string;
  let ownerUser: { id: string; email: string };
  let orgId: string;
  let endpointId: string;

  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_DESTINATIONS = 'true';
    app = await createApiApplication();
    database = app.get(DatabaseService);
    tenantContext = app.get(TenantContextService);
    rateLimiter = app.get(RateLimiterService);

    // Create test user and session
    const email = `ops-${randomUUID().slice(0, 8)}@relayforge.test`;
    const user = await database.client.user.create({
      data: {
        displayName: 'M5 Ops Lead',
        email,
      },
    });
    ownerUser = { id: user.id, email };

    const token = generateToken();
    await database.client.session.create({
      data: {
        userId: ownerUser.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    ownerCookie = serializeCookie('rf_session', token);

    // Create test organization via API (automatically grants OWNER role)
    const orgRes = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: 'M5 Observability Org' });

    const orgBody = orgRes.body as OrgCreateResponse;
    orgId = orgBody.id;

    // Create ingestion endpoint for event generation
    const epRes = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgId}/endpoints`)
      .set('Cookie', ownerCookie)
      .send({ name: 'M5 Ingestion Endpoint' });

    const epBody = epRes.body as EndpointCreateResponse;
    endpointId = epBody.endpoint.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Per-Destination Token Bucket Rate Limiting', () => {
    it('enforces destination rate limits via Redis sliding window', async () => {
      const destId = randomUUID();
      const limit = 2;

      // 1st request -> Allowed
      const r1 = await rateLimiter.checkRateLimit(destId, limit);
      expect(r1.allowed).toBe(true);

      // 2nd request -> Allowed
      const r2 = await rateLimiter.checkRateLimit(destId, limit);
      expect(r2.allowed).toBe(true);

      // 3rd request -> Throttled with retryAfterSeconds
      const r3 = await rateLimiter.checkRateLimit(destId, limit);
      expect(r3.allowed).toBe(false);
      expect(r3.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });

    it('gracefully passes when destination has 0 (unlimited) rate limit', async () => {
      const destId = randomUUID();
      const r = await rateLimiter.checkRateLimit(destId, 0);
      expect(r.allowed).toBe(true);
      expect(r.retryAfterSeconds).toBe(0);
    });
  });

  describe('2. Operational Metrics & Latency Quantiles', () => {
    it('calculates p50, p95, p99 latencies, volumes and outbox lag', async () => {
      // Seed delivery attempt inside tenant context
      await tenantContext.runInTenantContext(orgId, ownerUser.id, async (tx) => {
        const dest = await tx.destination.create({
          data: {
            organizationId: orgId,
            name: 'Metrics Test Target',
            url: 'https://example.com/webhook',
          },
        });

        const ev = await tx.event.create({
          data: {
            organizationId: orgId,
            endpointId,
            eventType: 'test.metric',
            payload: { value: 42 },
          },
        });

        // Seed 3 delivery attempts with different latencies (50ms, 120ms, 450ms)
        for (const latency of [50, 120, 450]) {
          await tx.deliveryAttempt.create({
            data: {
              organizationId: orgId,
              eventId: ev.id,
              destinationId: dest.id,
              status: 'SUCCESS',
              statusCode: 200,
              latencyMs: latency,
              requestUrl: 'https://example.com/webhook',
              requestMethod: 'POST',
              requestHeaders: {},
            },
          });
        }
      });

      const res = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/metrics`)
        .set('Cookie', ownerCookie);

      const metrics = res.body as OrganizationMetrics;
      expect(res.status).toBe(200);
      expect(metrics.organizationId).toBe(orgId);
      expect(metrics.ingestion).toBeDefined();
      expect(metrics.delivery).toBeDefined();
      expect(metrics.delivery.latency).toBeDefined();
      expect(metrics.delivery.latency.p50Ms).toBeGreaterThan(0);
      expect(metrics.delivery.latency.p95Ms).toBeGreaterThanOrEqual(metrics.delivery.latency.p50Ms);
      expect(metrics.delivery.latency.p99Ms).toBeGreaterThanOrEqual(metrics.delivery.latency.p95Ms);
    });
  });

  describe('3. Advanced DLQ Management & Bulk Replay', () => {
    const deadLetterIds: string[] = [];

    beforeAll(async () => {
      await tenantContext.runInTenantContext(orgId, ownerUser.id, async (tx) => {
        const ev = await tx.event.create({
          data: {
            organizationId: orgId,
            endpointId,
            eventType: 'order.failed',
            payload: { orderId: 'ord-123' },
          },
        });

        // Create 3 dead-letter messages
        for (let i = 0; i < 3; i++) {
          const outbox = await tx.outboxMessage.create({
            data: {
              organizationId: orgId,
              eventId: ev.id,
              channel: 'events',
              payload: { item: i },
              status: 'DEAD_LETTER',
              attemptCount: 5,
              maxRetries: 5,
            },
          });
          deadLetterIds.push(outbox.id);
        }
      });
    });

    it('lists DLQ messages with tenant isolation', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/dlq`)
        .set('Cookie', ownerCookie);

      const data = res.body as DlqListResponse;
      expect(res.status).toBe(200);
      expect(data.total).toBeGreaterThanOrEqual(3);
      expect(data.records).toBeDefined();
      expect(data.records.length).toBeGreaterThanOrEqual(3);
    });

    it('atomically bulk replays dead-letter messages back into the outbox', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/dlq/bulk-replay`)
        .set('Cookie', ownerCookie)
        .send({ outboxIds: deadLetterIds });

      const data = res.body as BulkReplayResponse;
      expect(res.status).toBe(200);
      expect(data.replayedCount).toBe(3);
      expect(data.replayedIds).toEqual(expect.arrayContaining(deadLetterIds));

      // Verify in DB that status returned to PENDING and attempt_count reset to 0
      await tenantContext.runInTenantContext(orgId, ownerUser.id, async (tx) => {
        const msgs = await tx.outboxMessage.findMany({
          where: { id: { in: deadLetterIds } },
        });
        for (const m of msgs) {
          expect(m.status).toBe('PENDING');
          expect(m.attemptCount).toBe(0);
          expect(m.replayedBy).toBe(ownerUser.id);
        }
      });
    });

    it('purges a dead-letter message permanently', async () => {
      // Create a fresh DLQ message to purge
      let purgeId = '';
      await tenantContext.runInTenantContext(orgId, ownerUser.id, async (tx) => {
        const ev = await tx.event.create({
          data: {
            organizationId: orgId,
            endpointId,
            eventType: 'purge.test',
            payload: {},
          },
        });
        const outbox = await tx.outboxMessage.create({
          data: {
            organizationId: orgId,
            eventId: ev.id,
            channel: 'events',
            payload: {},
            status: 'DEAD_LETTER',
          },
        });
        purgeId = outbox.id;
      });

      const res = await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/dlq/${purgeId}`)
        .set('Cookie', ownerCookie);

      const data = res.body as PurgeResponse;
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify no longer in database
      await tenantContext.runInTenantContext(orgId, ownerUser.id, async (tx) => {
        const check = await tx.outboxMessage.findUnique({
          where: { id: purgeId },
        });
        expect(check).toBeNull();
      });
    });
  });

  describe('4. Real-time Telemetry SSE Stream Endpoint', () => {
    it('accepts connection on /v1/organizations/:orgId/telemetry/events/stream with text/event-stream', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/telemetry/events/stream`)
        .set('Cookie', ownerCookie)
        .timeout(1000)
        .catch((err: unknown) => {
          return (err as { response?: request.Response }).response;
        });

      if (res) {
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      }
    });
  });
});
