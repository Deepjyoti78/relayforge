import type { AddressInfo } from 'node:net';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { generateToken, hashToken } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';
import { TenantContextService } from '../src/modules/database/tenant-context.service';
import { DeliveryService } from '../src/modules/delivery/delivery.service';
import { EndpointService } from '../src/modules/endpoints/endpoint.service';

describe('Phase 6: Distributed Concurrency & Replay Hardening (Integration)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let tenantContext: TenantContextService;
  let deliveryService: DeliveryService;
  let endpointService: EndpointService;
  let userA: { id: string; cookie: string };
  let orgA: { id: string };
  let validDestinationId: string;
  let hangingDestinationId: string;
  let testServer: http.Server;
  let hangingServer: http.Server;
  let hangingServerUrl: string;

  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_DESTINATIONS = 'true';

    // Hanging server to simulate transport timeouts
    hangingServer = http.createServer(() => {
      // Deliberately do not respond, causing client timeout
    });
    await new Promise<void>((resolve) => {
      hangingServer.listen(0, '127.0.0.1', () => {
        const addr = hangingServer.address() as AddressInfo;
        hangingServerUrl = `http://127.0.0.1:${addr.port}/hanging-target`;
        resolve();
      });
    });

    // Fast echo server
    testServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => {
      testServer.listen(0, '127.0.0.1', resolve);
    });

    app = await createApiApplication();
    database = app.get(DatabaseService);
    tenantContext = app.get(TenantContextService);
    deliveryService = app.get(DeliveryService);
    endpointService = app.get(EndpointService);

    // Create test user and organization
    const user = await database.client.user.create({
      data: { displayName: 'Concurrency Tester', email: `concurrency-${randomUUID()}@example.com` },
    });
    const token = generateToken();
    await database.client.session.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) },
    });
    userA = { id: user.id, cookie: serializeCookie('rf_session', token) };

    const resOrg = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userA.cookie)
      .send({ name: 'Concurrency Org' })
      .expect(201);
    orgA = { id: (resOrg.body as { id: string }).id };

    // Create valid test destination
    const resDest = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/destinations`)
      .set('Cookie', userA.cookie)
      .send({
        name: 'Echo Destination',
        url: 'http://127.0.0.1:9999/webhook',
        httpMethod: 'POST',
      })
      .expect(201);
    validDestinationId = (resDest.body as { id: string }).id;

    // Create hanging destination
    const resHangingDest = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/destinations`)
      .set('Cookie', userA.cookie)
      .send({
        name: 'Hanging Destination',
        url: hangingServerUrl,
        httpMethod: 'POST',
        timeoutMs: 1000,
      })
      .expect(201);
    hangingDestinationId = (resHangingDest.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => hangingServer.close(() => resolve()));
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  });

  describe('12. Two-Worker Race Condition & Optimistic Concurrency', () => {
    it('prevents stale Worker A from completing delivery after Worker B reclaims and acquires new lease', async () => {
      // Create endpoint and event
      const createdEndpoint = await endpointService.createEndpoint(orgA.id, userA.id, {
        name: 'Race Ingestion',
      });

      const { ev, out } = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        const ev = await tx.event.create({
          data: {
            organizationId: orgA.id,
            endpointId: createdEndpoint.endpoint.id,
            eventType: 'race.test',
            payload: { race: true },
            status: 'RECEIVED',
          },
        });
        const out = await tx.outboxMessage.create({
          data: {
            organizationId: orgA.id,
            eventId: ev.id,
            channel: 'webhook',
            payload: { race: true },
            status: 'PENDING',
            createdAt: new Date(Date.now() - 86400000), // Ensure prioritized order in test queue
          },
        });
        return { ev, out };
      });

      // Worker A claims the message with a 1-second lease
      const workerAClaims = await database.client.$queryRaw<{ id: string; lease_token: string }[]>`
        SELECT id, lease_token FROM claim_pending_outbox_messages(100, 1)
      `;
      const claimedA = workerAClaims.find((c) => c.id === out.id);
      expect(claimedA).toBeDefined();
      const leaseTokenA = claimedA!.lease_token;
      expect(leaseTokenA).toBeDefined();

      // Simulate lease expiration by advancing time in the database within tenant context
      await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox_messages
          SET lease_expires_at = NOW() - INTERVAL '5 seconds'
          WHERE id = ${out.id}::uuid
        `;
      });

      // Crash recovery sweeper reclaims the expired lease (SECURITY DEFINER)
      await database.client.$executeRaw`
        SELECT reclaim_stale_outbox_leases()
      `;

      // Worker B now claims the message and receives a fresh lease_token
      const workerBClaims = await database.client.$queryRaw<{ id: string; lease_token: string }[]>`
        SELECT id, lease_token FROM claim_pending_outbox_messages(100, 30)
      `;
      const claimedB = workerBClaims.find((c) => c.id === out.id);
      expect(claimedB).toBeDefined();
      const leaseTokenB = claimedB!.lease_token;
      expect(leaseTokenB).toBeDefined();
      expect(leaseTokenB).not.toBe(leaseTokenA);

      // Worker A wakes up late and tries to complete dispatch using stale leaseTokenA
      const completeResA = await database.client.$queryRaw<{ complete_outbox_dispatch: boolean }[]>`
        SELECT complete_outbox_dispatch(${out.id}::uuid, ${ev.id}::uuid, 'DISPATCHED', 'COMPLETED', ${leaseTokenA}::uuid)
      `;
      // CRITICAL DISTRIBUTED SYSTEMS ASSERTION: Stale worker update is rejected
      expect(completeResA[0]?.complete_outbox_dispatch).toBe(false);

      // Verify outbox message is still PENDING under Worker B's lease
      const outboxCheck = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findUnique({ where: { id: out.id } });
      });
      expect(outboxCheck?.status).toBe('PENDING');
      expect(outboxCheck?.leaseToken).toBe(leaseTokenB);

      // Worker B completes dispatch using valid leaseTokenB
      const completeResB = await database.client.$queryRaw<{ complete_outbox_dispatch: boolean }[]>`
        SELECT complete_outbox_dispatch(${out.id}::uuid, ${ev.id}::uuid, 'DISPATCHED', 'COMPLETED', ${leaseTokenB}::uuid)
      `;
      expect(completeResB[0]?.complete_outbox_dispatch).toBe(true);

      // Verify outbox is now DISPATCHED and lease cleared
      const finalOutbox = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findUnique({ where: { id: out.id } });
      });
      expect(finalOutbox?.status).toBe('DISPATCHED');
      expect(finalOutbox?.leaseToken).toBeNull();
    });
  });

  describe('13 & 14. Manual Replay Invariants & Concurrent Replay Protection', () => {
    it('14. Disallows replay of successfully DISPATCHED deliveries (prevents duplicate execution)', async () => {
      const createdEndpoint = await endpointService.createEndpoint(orgA.id, userA.id, {
        name: 'Dispatched Replay Test',
      });

      const { attempt } = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        const ev = await tx.event.create({
          data: {
            organizationId: orgA.id,
            endpointId: createdEndpoint.endpoint.id,
            eventType: 'success.event',
            payload: { ok: true },
            status: 'COMPLETED',
          },
        });
        const out = await tx.outboxMessage.create({
          data: {
            organizationId: orgA.id,
            eventId: ev.id,
            channel: 'webhook',
            payload: { ok: true },
            status: 'DISPATCHED',
            dispatchedAt: new Date(),
          },
        });
        const att = await tx.deliveryAttempt.create({
          data: {
            organizationId: orgA.id,
            eventId: ev.id,
            destinationId: validDestinationId,
            outboxMessageId: out.id,
            attemptNumber: 1,
            status: 'SUCCESS',
            statusCode: 200,
            latencyMs: 15,
            requestUrl: 'http://example.com/ok',
            requestMethod: 'POST',
            requestHeaders: {},
            responseHeaders: {},
            responseBodyPreview: 'OK',
            errorDescription: null,
          },
        });
        return { outbox: out, attempt: att };
      });

      // Attempting to replay a successful delivery MUST be rejected
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/deliveries/${attempt.id}/replay`)
        .set('Cookie', userA.cookie)
        .expect(400);

      expect((res.body as { message: string }).message).toContain('Cannot replay a successfully dispatched delivery');
    });

    it('13. Concurrent Replay Protection: Two simultaneous replay requests - exactly one succeeds, second is rejected', async () => {
      const createdEndpoint = await endpointService.createEndpoint(orgA.id, userA.id, {
        name: 'Concurrent Replay Test',
      });

      const { outbox, attempt } = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        const ev = await tx.event.create({
          data: {
            organizationId: orgA.id,
            endpointId: createdEndpoint.endpoint.id,
            eventType: 'deadletter.event',
            payload: { failed: true },
            status: 'FAILED',
          },
        });
        const out = await tx.outboxMessage.create({
          data: {
            organizationId: orgA.id,
            eventId: ev.id,
            channel: 'webhook',
            payload: { failed: true },
            status: 'DEAD_LETTER',
            dispatchedAt: new Date(),
            attemptCount: 5,
          },
        });
        const att = await tx.deliveryAttempt.create({
          data: {
            organizationId: orgA.id,
            eventId: ev.id,
            destinationId: validDestinationId,
            outboxMessageId: out.id,
            attemptNumber: 5,
            status: 'FAILED',
            statusCode: 500,
            latencyMs: 25,
            requestUrl: 'http://example.com/fail',
            requestMethod: 'POST',
            requestHeaders: {},
            responseHeaders: {},
            responseBodyPreview: 'FAIL',
            errorDescription: 'HTTP 500: Server Error',
          },
        });
        return { outbox: out, attempt: att };
      });

      // Fire two replay requests concurrently
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/v1/organizations/${orgA.id}/deliveries/${attempt.id}/replay`)
          .set('Cookie', userA.cookie),
        request(app.getHttpServer())
          .post(`/v1/organizations/${orgA.id}/deliveries/${attempt.id}/replay`)
          .set('Cookie', userA.cookie),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one succeeds (200), and the second is rejected with 409 Conflict (or 400 if already transitioned)
      expect(statuses[0]).toBe(200);
      expect([400, 409]).toContain(statuses[1]);

      // Verify outbox was transitioned to PENDING and user attribution recorded
      const outboxUpdated = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.outboxMessage.findUnique({ where: { id: outbox.id } });
      });
      expect(outboxUpdated?.status).toBe('PENDING');
      expect(outboxUpdated?.attemptCount).toBe(0);
      expect(outboxUpdated?.replayedBy).toBe(userA.id);
      expect(outboxUpdated?.replayedAt).toBeDefined();
    });
  });

  describe('15. UNKNOWN Delivery Outcome on Transport Timeout', () => {
    it('records status UNKNOWN when transport times out (receipt ambiguous)', async () => {
      const createdEndpoint = await endpointService.createEndpoint(orgA.id, userA.id, {
        name: 'Timeout Test Endpoint',
      });

      const event = await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        return tx.event.create({
          data: {
            organizationId: orgA.id,
            endpointId: createdEndpoint.endpoint.id,
            eventType: 'timeout.test',
            payload: { timeout: true },
            status: 'RECEIVED',
          },
        });
      });

      // Deliver to hanging server with a fast 1000ms timeout
      const attempt = await deliveryService.deliverEventToDestination({
        organizationId: orgA.id,
        eventId: event.id,
        destination: {
          id: hangingDestinationId,
          url: hangingServerUrl,
          timeoutMs: 1000,
        },
        payload: { timeout: true },
        eventType: 'timeout.test',
      });

      // CRITICAL DISTRIBUTED SYSTEMS ASSERTION:
      // A transport timeout cannot guarantee whether receiver accepted request or not.
      // Must be classified as UNKNOWN.
      expect(attempt.status).toBe('UNKNOWN');
      expect(attempt.statusCode).toBeNull();
      expect(attempt.errorDescription).toContain('ambiguous');
    });
  });
});
