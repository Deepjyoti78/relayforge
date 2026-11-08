import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { generateToken, hashToken, signWebhookPayload } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';
import { TenantContextService } from '../src/modules/database/tenant-context.service';
import { DeliveryService } from '../src/modules/delivery/delivery.service';
import { EndpointService } from '../src/modules/endpoints/endpoint.service';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { OutboxWorkerService } from '../src/worker/outbox-worker.service';

interface ReceivedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

describe('Milestone 3 Option 2: Durable HTTP Delivery Pipeline & Outbox Dispatcher (Integration)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let tenantContext: TenantContextService;
  let deliveryService: DeliveryService;
  let endpointService: EndpointService;
  let ingestionService: IngestionService;
  let outboxWorker: OutboxWorkerService;

  let testServer: http.Server;
  let testServerUrl: string;
  const receivedRequests: ReceivedRequest[] = [];

  let userA: { id: string; email: string; cookie: string };
  let userB: { id: string; email: string; cookie: string };

  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };

  let endpointA: { id: string; signingSecret: string };
  let destinationA: { id: string; url: string };

  beforeAll(async () => {
    // 1. Start local mock HTTP recipient server on an ephemeral port
    testServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        receivedRequests.push({
          method: req.method || 'POST',
          url: req.url || '/',
          headers: req.headers,
          body,
        });

        if (req.url === '/fail') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal failure' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
        }
      });
    });

    await new Promise<void>((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        const addr = testServer.address() as AddressInfo;
        testServerUrl = `http://127.0.0.1:${addr.port}/webhook-target`;
        resolve();
      });
    });

    // 2. Initialize NestJS App
    process.env.ALLOW_PRIVATE_DESTINATIONS = 'true';
    app = await createApiApplication();
    database = app.get(DatabaseService);
    tenantContext = app.get(TenantContextService);
    deliveryService = app.get(DeliveryService);
    endpointService = app.get(EndpointService);
    ingestionService = app.get(IngestionService);
    outboxWorker = new OutboxWorkerService(database, deliveryService);

    const createUserWithSession = async (displayName: string, email: string) => {
      const user = await database.client.user.create({
        data: { displayName, email },
      });
      const token = generateToken();
      const tokenHash = hashToken(token);
      await database.client.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      return {
        id: user.id,
        email,
        cookie: serializeCookie('rf_session', token),
      };
    };

    userA = await createUserWithSession('Owner A', `del-owner-a-${randomUUID()}@example.com`);
    userB = await createUserWithSession('Owner B', `del-owner-b-${randomUUID()}@example.com`);

    // Create Org A
    const resOrgA = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userA.cookie)
      .send({ name: 'Delivery Corp A' })
      .expect(201);
    orgA = { id: (resOrgA.body as { id: string }).id, name: 'Delivery Corp A' };

    // Create Org B
    const resOrgB = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userB.cookie)
      .send({ name: 'Delivery Corp B' })
      .expect(201);
    orgB = { id: (resOrgB.body as { id: string }).id, name: 'Delivery Corp B' };

    // Create Endpoint in Org A
    const createdEndpoint = await endpointService.createEndpoint(orgA.id, userA.id, {
      name: 'Stripe Webhooks Ingest',
      slug: `stripe-${randomUUID().slice(0, 8)}`,
    });
    endpointA = { id: createdEndpoint.endpoint.id, signingSecret: createdEndpoint.signingSecret };

    // Create Destination in Org A pointing to our test server
    const resDestA = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/destinations`)
      .set('Cookie', userA.cookie)
      .send({
        name: 'Local Webhook Target',
        url: testServerUrl,
        httpMethod: 'POST',
        headers: { 'X-RelayForge-Test': 'Active' },
      })
      .expect(201);
    destinationA = { id: (resDestA.body as { id: string }).id, url: testServerUrl };
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => {
      testServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    receivedRequests.length = 0;
  });

  describe('testDestinationPing (Interactive Testing)', () => {
    it('executes real HTTP ping to destination and stores delivery attempt', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations/${destinationA.id}/test`)
        .set('Cookie', userA.cookie)
        .expect(200);

      const attempt = res.body as {
        id: string;
        status: string;
        statusCode: number;
        latencyMs: number;
        requestUrl: string;
        responseBodyPreview: string;
      };

      expect(attempt.status).toBe('SUCCESS');
      expect(attempt.statusCode).toBe(200);
      expect(attempt.latencyMs).toBeGreaterThanOrEqual(0);
      expect(attempt.requestUrl).toBe(testServerUrl);
      expect(attempt.responseBodyPreview).toContain('success');

      // Verify HTTP server received request with headers
      expect(receivedRequests).toHaveLength(1);
      const reqReceived = receivedRequests[0]!;
      expect(reqReceived.method).toBe('POST');
      expect(reqReceived.headers['x-relayforge-event']).toBe('relayforge.ping');
      expect(reqReceived.headers['x-relayforge-test']).toBe('Active');
      expect(reqReceived.headers['user-agent']).toContain('RelayForge');
    });
  });

  describe('End-to-End: Ingestion -> Transactional Outbox -> Outbox Worker Dispatch', () => {
    it('ingests webhook, queues outbox message, dispatches via worker, and creates durable attempt record', async () => {
      const testPayload = {
        id: 'evt_stripe_123',
        type: 'charge.succeeded',
        data: { amount: 9900, currency: 'usd' },
      };

      const rawBody = JSON.stringify(testPayload);
      const signature = signWebhookPayload(rawBody, endpointA.signingSecret);

      // 1. Ingest webhook event into Org A endpoint
      const ingestRes = await ingestionService.ingestWebhook(
        endpointA.id,
        rawBody,
        {
          'content-type': 'application/json',
          'user-agent': 'Stripe/1.0',
          'x-relayforge-signature': signature,
          'x-event-type': 'charge.succeeded',
          'x-idempotency-key': `idempotency-${randomUUID()}`,
        },
        testPayload,
      );

      expect(ingestRes.status).toBe('accepted');
      expect(ingestRes.eventId).toBeDefined();

      // Verify event was created with RECEIVED status and outbox message is PENDING
      const outboxBefore = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findFirst({
          where: { eventId: ingestRes.eventId },
        });
      });
      expect(outboxBefore).toBeDefined();
      expect(outboxBefore?.status).toBe('PENDING');

      // 2. Trigger OutboxWorker sweep
      const sweptCount = await outboxWorker.sweepPendingOutbox();
      expect(sweptCount).toBeGreaterThanOrEqual(1);

      // 3. Verify downstream HTTP server received the webhook request with valid HMAC signature
      expect(receivedRequests.length).toBeGreaterThanOrEqual(1);
      const received = receivedRequests.find((r) => r.body.includes('evt_stripe_123'));
      expect(received).toBeDefined();
      expect(received?.headers['x-relayforge-event']).toBe('charge.succeeded');
      expect(received?.headers['x-relayforge-signature']).toBeDefined();

      // 4. Verify outbox message transitioned to DISPATCHED
      const outboxAfter = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findUnique({
          where: { id: outboxBefore!.id },
        });
      });
      expect(outboxAfter?.status).toBe('DISPATCHED');
      expect(outboxAfter?.dispatchedAt).toBeDefined();

      // 5. Verify event status transitioned to COMPLETED
      const eventAfter = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.event.findUnique({
          where: { id: ingestRes.eventId },
        });
      });
      expect(eventAfter?.status).toBe('COMPLETED');

      // 6. Verify durable delivery attempt record exists in database
      const attempts = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.deliveryAttempt.findMany({
          where: { eventId: ingestRes.eventId },
        });
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.status).toBe('SUCCESS');
      expect(attempts[0]?.statusCode).toBe(200);
      expect(attempts[0]?.latencyMs).toBeGreaterThanOrEqual(0);
      expect(attempts[0]?.responseBodyPreview).toContain('success');
    });
  });

  describe('Multi-Tenant Row-Level Security (RLS) Isolation', () => {
    it('prevents Org B from viewing Org A delivery attempts', async () => {
      // User A can view Org A deliveries
      const resA = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/deliveries`)
        .set('Cookie', userA.cookie)
        .expect(200);

      const deliveriesA = resA.body as unknown[];
      expect(deliveriesA.length).toBeGreaterThan(0);

      // User B in Org B requests their deliveries -> strictly 0 attempts
      const resB = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgB.id}/deliveries`)
        .set('Cookie', userB.cookie)
        .expect(200);

      const deliveriesB = resB.body as unknown[];
      expect(deliveriesB).toHaveLength(0);

      // User B attempting to view Org A deliveries directly is rejected by RLS
      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/deliveries`)
        .set('Cookie', userB.cookie)
        .expect(404);
    });
  });

  describe('Milestone 3 Option 3: Retry Scheduling, Dead Letters & Crash Recovery', () => {
    let failEndpoint: { id: string; signingSecret: string };
    let failDestination: { id: string; url: string };

    beforeAll(async () => {
      // Create endpoint in Org A for failure tests
      const createdEp = await endpointService.createEndpoint(orgA.id, userA.id, {
        name: 'Retry Ingest Endpoint',
        slug: `retry-${randomUUID().slice(0, 8)}`,
      });
      failEndpoint = { id: createdEp.endpoint.id, signingSecret: createdEp.signingSecret };

      // Deactivate destinationA so Org A only delivers to fail destination
      await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        await tx.destination.update({
          where: { id: destinationA.id },
          data: { isActive: false },
        });
      });

      // Create destination targeting the 500 endpoint
      const failUrl = testServerUrl.replace('/webhook-target', '/fail');
      const resDest = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'Failing Destination Target',
          url: failUrl,
          httpMethod: 'POST',
        })
        .expect(201);

      failDestination = { id: (resDest.body as { id: string }).id, url: failUrl };
      expect(failDestination.id).toBeDefined();
    });

    it('schedules retry with exponential backoff on transient failure (HTTP 500)', async () => {
      const payload = { event: 'order.placed', orderId: 999 };
      const rawBody = JSON.stringify(payload);
      const signature = signWebhookPayload(rawBody, failEndpoint.signingSecret);

      const ingestRes = await ingestionService.ingestWebhook(
        failEndpoint.id,
        rawBody,
        {
          'content-type': 'application/json',
          'x-relayforge-signature': signature,
          'x-event-type': 'order.placed',
          'x-idempotency-key': `retry-test-${randomUUID()}`,
        },
        payload,
      );

      // Trigger worker sweep
      await outboxWorker.sweepPendingOutbox();

      // Verify outbox message is still PENDING with nextRetryAt scheduled in the future
      const outbox = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findFirst({
          where: { eventId: ingestRes.eventId },
        });
      });

      expect(outbox).toBeDefined();
      expect(outbox?.status).toBe('PENDING');
      expect(outbox?.attemptCount).toBe(1);
      expect(outbox?.nextRetryAt).toBeDefined();
      expect(outbox?.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
      expect(outbox?.leaseExpiresAt).toBeNull();

      // Verify delivery attempt record captured 500 FAILED
      const attempts = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.deliveryAttempt.findMany({
          where: { eventId: ingestRes.eventId },
        });
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.status).toBe('FAILED');
      expect(attempts[0]?.statusCode).toBe(500);

      // Verify manual replay API redelivers by resetting next_retry_at to NOW()
      const replayRes = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/deliveries/${attempts[0]!.id}/replay`)
        .set('Cookie', userA.cookie)
        .expect(200);

      expect((replayRes.body as { success: boolean }).success).toBe(true);

      const outboxReplayed = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findUnique({
          where: { id: outbox!.id },
        });
      });
      expect(outboxReplayed?.status).toBe('PENDING');
      expect(outboxReplayed?.attemptCount).toBe(0);
      expect(outboxReplayed?.nextRetryAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('transitions exhausted delivery to DEAD_LETTER when max retries exceeded', async () => {
      const payload = { event: 'invoice.failed', invoiceId: 101 };
      const rawBody = JSON.stringify(payload);
      const signature = signWebhookPayload(rawBody, failEndpoint.signingSecret);

      const ingestRes = await ingestionService.ingestWebhook(
        failEndpoint.id,
        rawBody,
        {
          'content-type': 'application/json',
          'x-relayforge-signature': signature,
          'x-event-type': 'invoice.failed',
          'x-idempotency-key': `dlq-test-${randomUUID()}`,
        },
        payload,
      );

      // Simulate 4 prior failed attempts
      await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        await tx.outboxMessage.updateMany({
          where: { eventId: ingestRes.eventId },
          data: {
            attemptCount: 4,
            nextRetryAt: new Date(Date.now() - 1000), // Ready to run
          },
        });
      });

      // Sweep will attempt 5th time (attempt_count becomes 5 >= maxRetries) and fail
      await outboxWorker.sweepPendingOutbox();

      const outbox = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findFirst({
          where: { eventId: ingestRes.eventId },
        });
      });

      expect(outbox?.status).toBe('DEAD_LETTER');
      expect(outbox?.dispatchedAt).toBeDefined();

      const event = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.event.findUnique({
          where: { id: ingestRes.eventId },
        });
      });
      expect(event?.status).toBe('FAILED');
    });

    it('reclaims stale in-flight leases left by crashed workers', async () => {
      // Insert a simulated in-flight message with expired lease
      const outboxId = randomUUID();
      const eventId = randomUUID();

      await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        await tx.event.create({
          data: {
            id: eventId,
            organizationId: orgA.id,
            endpointId: failEndpoint.id,
            eventType: 'crash.simulated',
            payload: { crashed: true },
            status: 'PROCESSING',
          },
        });

        await tx.outboxMessage.create({
          data: {
            id: outboxId,
            organizationId: orgA.id,
            eventId,
            channel: 'events',
            payload: { crashed: true },
            status: 'PENDING',
            attemptCount: 1,
            leaseExpiresAt: new Date(Date.now() - 5000), // Lease expired 5 seconds ago
          },
        });
      });

      // Run crash recovery lease sweep
      const reclaimed = await outboxWorker.sweepStaleLeases();
      expect(reclaimed).toBeGreaterThanOrEqual(1);

      // Verify lease was cleared so new workers can claim it
      const outbox = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findUnique({
          where: { id: outboxId },
        });
      });
      expect(outbox?.status).toBe('PENDING');
      expect(outbox?.leaseExpiresAt).toBeNull();
    });
  });
});
