import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApiApplication } from '../src/api/create-api';
import { hashToken, signWebhookPayload } from '../src/common/crypto';
import { RuntimeConfig } from '../src/modules/config/config.module';
import { parseEnvironment } from '../src/modules/config/environment';
import { DatabaseService } from '../src/modules/database/database.service';
import { TenantContextService } from '../src/modules/database/tenant-context.service';
import { DeliveryService } from '../src/modules/delivery/delivery.service';
import { DlqService } from '../src/modules/delivery/dlq.service';
import { RateLimiterService } from '../src/modules/delivery/rate-limiter.service';
import { EventStreamService } from '../src/modules/observability/event-stream.service';
import { EndpointService } from '../src/modules/endpoints/endpoint.service';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { OutboxWorkerService } from '../src/worker/outbox-worker.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('webhook delivery reliability with PostgreSQL and Redis', () => {
  const trustedOrigin = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  let app: NestExpressApplication;
  let db: DatabaseService;
  let workerDb: DatabaseService;
  let tenant: TenantContextService;
  let admin: Pool;
  let server: Server;
  let origin: string;
  const workers: OutboxWorkerService[] = [];
  const routes = new Map<string, (body: string, res: ServerResponse) => void>();
  const received: { path: string; body: string; headers: IncomingHttpHeaders }[] = [];
  const orgs: string[] = [];

  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_DESTINATIONS = 'true'; // test-only loopback recipients
    app = await createApiApplication();
    db = app.get(DatabaseService);
    tenant = app.get(TenantContextService);
    workerDb = new DatabaseService(new RuntimeConfig(parseEnvironment('worker', process.env)));
    await workerDb.onModuleInit();
    admin = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        const path = req.url ?? '/';
        received.push({ path, body, headers: req.headers });
        const route = routes.get(path);
        if (route) route(body, res);
        else { res.statusCode = 404; res.end(); }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await Promise.all(workers.splice(0).map((worker) => worker.onModuleDestroy()));
    // Only retire this suite's fixtures; other integration suites own their data.
    for (const org of orgs.splice(0)) {
      await admin.query("UPDATE outbox_messages SET status='DISPATCHED', lease_token=NULL, lease_expires_at=NULL WHERE org_id=$1", [org]);
    }
  });
  afterAll(async () => {
    await app?.close();
    await workerDb?.onApplicationShutdown();
    await admin?.end();
    server?.closeAllConnections();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  function worker() {
    const instance = new OutboxWorkerService(workerDb, app.get(DeliveryService), app.get(RateLimiterService),
      app.get(EventStreamService), undefined, app.get(RuntimeConfig));
    workers.push(instance);
    return instance;
  }

  async function fixture() {
    const user = await db.client.user.create({ data: { email: `${randomUUID()}@reliability.test`, displayName: 'Delivery tester' } });
    const token = randomUUID();
    await db.client.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) } });
    const response = await request(app.getHttpServer()).post('/v1/organizations').set('Cookie', `rf_session=${token}`).set('Origin', trustedOrigin)
      .send({ name: 'Reliability fixtures' }).expect(201);
    const org = (response.body as { id: string }).id;
    orgs.push(org);
    const endpoint = await app.get(EndpointService).createEndpoint(org, user.id, { name: 'Origin one' });
    const addDestination = async (handler: (body: string, res: ServerResponse) => void, timeoutMs = 1000) => {
      const path = `/${randomUUID()}`;
      routes.set(path, handler);
      const dest = await tenant.runInTenantContext(org, user.id, (tx) => tx.destination.create({ data: {
        organizationId: org, name: path, url: origin + path, rateLimitPerSecond: 0, timeoutMs,
      } }));
      return { ...dest, path };
    };
    const ingest = async (payload: unknown, source = endpoint, key = randomUUID()) => {
      const body = JSON.stringify(payload);
      const result = await app.get(IngestionService).ingestWebhook(source.endpoint.id, body, {
        'content-type': 'application/json', 'x-relayforge-signature': signWebhookPayload(body, source.signingSecret),
        'x-idempotency-key': key, 'x-event-type': 'reliability.test',
      }, payload);
      const outbox = await tenant.runInTenantContext(org, user.id, (tx) => tx.outboxMessage.findFirstOrThrow({ where: { eventId: result.eventId } }));
      return { ...result, outbox };
    };
    const state = (id: string) => tenant.runInTenantContext(org, user.id, (tx) => tx.outboxMessage.findUniqueOrThrow({ where: { id } }));
    const targets = (id: string) => tenant.runInTenantContext(org, user.id, (tx) => tx.destinationDelivery.findMany({ where: { outboxMessageId: id }, orderBy: { destinationId: 'asc' } }));
    return { org, user, token, endpoint, addDestination, ingest, state, targets };
  }

  async function due(id: string) {
    await admin.query('UPDATE outbox_messages SET next_retry_at=clock_timestamp() WHERE id=$1', [id]);
    await admin.query("UPDATE destination_deliveries SET next_retry_at=clock_timestamp() WHERE outbox_message_id=$1 AND status='PENDING'", [id]);
  }

  async function claimOnly(id: string) {
    const others = await admin.query<{ id: string }>('SELECT id FROM outbox_messages WHERE id<>$1', [id]);
    const excluded = others.rows.map((row) => row.id);
    return workerDb.client.$queryRaw<{ id: string; lease_token: string }[]>`
      SELECT * FROM claim_pending_outbox_messages(1,30,${excluded}::uuid[])
    `;
  }

  it('accepts a signed synthetic event through HTTP provisioning and rejects foreign-tenant management access', async () => {
    const f = await fixture();
    const foreign = await fixture();
    const cookie = `rf_session=${f.token}`;
    const base = `/v1/organizations/${f.org}`;
    const key = await request(app.getHttpServer()).post(`${base}/api-keys`).set('Cookie', cookie).set('Origin', trustedOrigin)
      .send({ name: 'Synthetic acceptance only', scopes: ['ingest'] }).expect(201);
    expect((key.body as { apiKey: string }).apiKey).toMatch(/^rf_live_/);
    const endpointResponse = await request(app.getHttpServer()).post(`${base}/endpoints`).set('Cookie', cookie).set('Origin', trustedOrigin)
      .send({ name: 'HTTP acceptance origin' }).expect(201);
    const source = endpointResponse.body as { endpoint: { id: string }; signingSecret: string };
    const path = `/${randomUUID()}`;
    routes.set(path, (_body, res) => { res.end('synthetic accepted'); });
    const destination = await request(app.getHttpServer()).post(`${base}/destinations`).set('Cookie', cookie).set('Origin', trustedOrigin)
      .send({ name: 'Owned loopback receiver', url: origin + path, rateLimitPerSecond: 50, timeoutMs: 1000 }).expect(201);
    const payload = JSON.stringify({ synthetic: true, runId: randomUUID() });
    const ingestPath = `/v1/ingest/${source.endpoint.id}`;
    await request(app.getHttpServer()).post(ingestPath).set('Content-Type', 'application/json')
      .set('x-relayforge-signature', 'sha256=invalid').send(payload).expect(401);
    const idempotency = randomUUID();
    const send = () => request(app.getHttpServer()).post(ingestPath).set('Content-Type', 'application/json')
      .set('x-relayforge-signature', signWebhookPayload(payload, source.signingSecret))
      .set('x-idempotency-key', idempotency).send(payload);
    const accepted = await send().expect(202);
    await send().expect(200);
    await worker().sweepPendingOutbox();
    expect(received.filter((r) => r.path === path)).toHaveLength(1);
    const sent = received.find((r) => r.path === path)!;
    expect(sent.headers['x-relayforge-signature']).toBe(signWebhookPayload(sent.body, source.signingSecret, Number(sent.headers['x-relayforge-timestamp'])));
    const attempts = await request(app.getHttpServer()).get(`${base}/deliveries?eventId=${(accepted.body as { eventId: string }).eventId}`)
      .set('Cookie', cookie).set('Origin', trustedOrigin).expect(200);
    expect(JSON.stringify(attempts.body)).toContain('SUCCESS');
    const foreignCookie = `rf_session=${foreign.token}`;
    await request(app.getHttpServer()).get(`${base}/deliveries`).set('Cookie', foreignCookie).set('Origin', trustedOrigin).expect(404);
    await request(app.getHttpServer()).post(`${base}/api-keys`).set('Cookie', foreignCookie).set('Origin', trustedOrigin)
      .send({ name: 'Denied' }).expect(404);
    await request(app.getHttpServer()).get(`${base}/destinations/${(destination.body as { id: string }).id}`)
      .set('Cookie', foreignCookie).set('Origin', trustedOrigin).expect(404);
    await request(app.getHttpServer()).get(`${base}/dlq`).set('Cookie', foreignCookie).set('Origin', trustedOrigin).expect(403);
  });

  it('keeps a mixed 200/500 event pending and retries only the failed destination', async () => {
    const f = await fixture();
    const good = await f.addDestination((_body, res) => { res.end('ok'); });
    let badStatus = 500;
    const bad = await f.addDestination((_body, res) => { res.statusCode = badStatus; res.end('retry'); });
    const event = await f.ingest({ mixed: randomUUID() });
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('PENDING');
    expect(received.filter((r) => r.path === good.path)).toHaveLength(1);
    expect(received.filter((r) => r.path === bad.path)).toHaveLength(1);
    const late = await f.addDestination((_body, res) => { res.end('not in snapshot'); });
    badStatus = 200;
    await due(event.outbox.id);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect(received.filter((r) => r.path === good.path)).toHaveLength(1);
    expect(received.filter((r) => r.path === late.path)).toHaveLength(0);
    const failures = received.filter((r) => r.path === bad.path);
    expect(failures).toHaveLength(2);
    expect(failures[0]!.headers['idempotency-key']).toBe(failures[1]!.headers['idempotency-key']);
    expect(failures[0]!.headers['x-relayforge-attempt-id']).not.toBe(failures[1]!.headers['x-relayforge-attempt-id']);
    expect((await f.targets(event.outbox.id)).map((s) => s.attemptCount).sort()).toEqual([1, 2]);
  });

  it('signs with the originating endpoint rather than the oldest endpoint in the organization', async () => {
    const f = await fixture();
    const second = await app.get(EndpointService).createEndpoint(f.org, f.user.id, { name: 'Origin two' });
    const dest = await f.addDestination((_body, res) => { res.end('ok'); });
    await f.ingest({ endpoint: 'second' }, second);
    await worker().sweepPendingOutbox();
    const sent = received.find((r) => r.path === dest.path)!;
    const timestamp = Number(sent.headers['x-relayforge-timestamp']);
    expect(sent.headers['x-relayforge-signature']).toBe(signWebhookPayload(sent.body, second.signingSecret, timestamp));
    expect(sent.headers['x-relayforge-signature']).not.toBe(signWebhookPayload(sent.body, f.endpoint.signingSecret, timestamp));
  });

  it('does not send an unstarted batch message again after its lease was reclaimed', async () => {
    const f = await fixture();
    const started = deferred();
    const release = deferred();
    const dest = await f.addDestination((body, res) => {
      if ((JSON.parse(body) as { sequence: number }).sequence === 1) {
        started.resolve();
        void release.promise.then(() => { res.end('slow ok'); });
      } else res.end('second ok');
    }, 10000);
    await f.ingest({ sequence: 1 });
    const second = await f.ingest({ sequence: 2 });
    const firstSweep = worker().sweepPendingOutbox();
    await started.promise;
    try {
      // Simulate time passing for the queued row's lease, without a 30s sleep.
      await admin.query("UPDATE outbox_messages SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1 AND lease_token IS NOT NULL", [second.outbox.id]);
      await worker().sweepPendingOutbox();
    } finally { release.resolve(); await firstSweep; }
    expect(received.filter((r) => r.path === dest.path && (JSON.parse(r.body) as { sequence: number }).sequence === 2)).toHaveLength(1);
  });

  it('bounds retries per destination, routes partial failure to DLQ, and replays only unfinished destinations', async () => {
    const f = await fixture();
    const good = await f.addDestination((_body, res) => { res.end('ok'); });
    let response = 500;
    const bad = await f.addDestination((_body, res) => { res.statusCode = response; res.end(); });
    const event = await f.ingest({ retry: true });
    await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.outboxMessage.update({ where: { id: event.outbox.id }, data: { maxRetries: 2 } }));
    await worker().sweepPendingOutbox();
    const scheduled = await f.state(event.outbox.id);
    expect(scheduled.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
    await due(event.outbox.id);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DEAD_LETTER');
    expect((await f.targets(event.outbox.id)).filter((s) => s.status === 'DEAD_LETTER')).toHaveLength(1);
    const dlq = await app.get(DlqService).listDlqMessages(f.org, f.user.id);
    const listed = dlq.records.find((r) => r.id === event.outbox.id)!;
    expect(listed.destinationId).toBe(bad.id);
    expect(listed.attemptCount).toBe(2);
    expect(listed.destinationFailures?.map((d) => d.destinationId)).toEqual([bad.id]);
    const attempt = await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.deliveryAttempt.findFirstOrThrow({ where: { eventId: event.eventId, destinationId: bad.id } }));
    response = 200;
    await app.get(DeliveryService).replayDelivery(f.org, f.user.id, attempt.id);
    await expect(app.get(DeliveryService).replayDelivery(f.org, f.user.id, attempt.id)).rejects.toThrow();
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect(received.filter((r) => r.path === good.path)).toHaveLength(1);
    expect(received.filter((r) => r.path === bad.path)).toHaveLength(3);
    await expect(app.get(DeliveryService).replayDelivery(f.org, f.user.id, attempt.id)).rejects.toThrow(/successfully dispatched/);
  });

  it('fences duplicate claims, expired tokens and duplicate destination starts', async () => {
    const f = await fixture();
    const dest = await f.addDestination((_body, res) => { res.end(); });
    const event = await f.ingest({ fencing: true });
    const claims = await Promise.all([0, 1].map(() => claimOnly(event.outbox.id)));
    const own = claims.flat().filter((r) => r.id === event.outbox.id);
    expect(own).toHaveLength(1);
    const token = own[0]!.lease_token;
    await workerDb.client.$queryRaw`SELECT * FROM prepare_destination_deliveries(${event.outbox.id}::uuid,${token}::uuid)`;
    const first = await workerDb.client.$queryRaw<{ n: number }[]>`SELECT begin_destination_delivery(${event.outbox.id}::uuid,${dest.id}::uuid,${token}::uuid) AS n`;
    expect(first[0]!.n).toBe(1);
    const duplicate = await workerDb.client.$queryRaw<{ n: number }[]>`SELECT begin_destination_delivery(${event.outbox.id}::uuid,${dest.id}::uuid,${token}::uuid) AS n`;
    expect(duplicate[0]!.n).toBe(0);
    await admin.query("UPDATE outbox_messages SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [event.outbox.id]);
    const stale = await workerDb.client.$queryRaw<{ accepted: boolean }[]>`SELECT record_destination_result(${event.outbox.id}::uuid,${dest.id}::uuid,${token}::uuid,'DISPATCHED',NULL,NULL) AS accepted`;
    expect(stale[0]!.accepted).toBe(false);
    const renewed = await workerDb.client.$queryRaw<{ accepted: boolean }[]>`SELECT renew_outbox_lease(${event.outbox.id}::uuid,${token}::uuid,30) AS accepted`;
    expect(renewed[0]!.accepted).toBe(false);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect((await f.targets(event.outbox.id))[0]!.attemptCount).toBe(2);
  });

  it('enforces target-state RLS and event/endpoint organization scoping', async () => {
    const a = await fixture();
    const b = await fixture();
    await a.addDestination((_body, res) => { res.end(); });
    const event = await a.ingest({ isolation: true });
    await worker().sweepPendingOutbox();
    expect(await tenant.runInTenantContext(b.org, b.user.id, (tx) => tx.destinationDelivery.findMany({ where: { outboxMessageId: event.outbox.id } }))).toEqual([]);
    await expect(tenant.runInTenantContext(a.org, a.user.id, (tx) => tx.$executeRaw`UPDATE destination_deliveries SET status='PENDING' WHERE outbox_message_id=${event.outbox.id}::uuid`)).rejects.toThrow();
    const wrong = await workerDb.client.$queryRaw<unknown[]>`SELECT * FROM get_event_endpoint_signing_secret(${b.org}::uuid,${event.eventId}::uuid)`;
    expect(wrong).toEqual([]);
    await expect(db.client.$queryRaw`SELECT * FROM prepare_destination_deliveries(${event.outbox.id}::uuid,${randomUUID()}::uuid)`).rejects.toThrow();
  });

  it('renews a live lease during slow HTTP and drains shutdown before releasing resources', async () => {
    const f = await fixture();
    const started = deferred();
    const release = deferred();
    const dest = await f.addDestination((_body, res) => { started.resolve(); void release.promise.then(() => { res.end(); }); }, 20000);
    const event = await f.ingest({ slow: true });
    const live = worker();
    const sweep = live.sweepPendingOutbox();
    await started.promise;
    try {
      await delay(11000); // exercise the real 10-second heartbeat, not a fake timer
      expect((await f.state(event.outbox.id)).leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 18000);
      const competing = await claimOnly(event.outbox.id);
      expect(competing.some((r) => r.id === event.outbox.id)).toBe(false);
      let closed = false;
      const closing = live.onModuleDestroy().then(() => { closed = true; });
      await delay(20);
      expect(closed).toBe(false);
      release.resolve();
      await closing;
    } finally { release.resolve(); await sweep; }
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect(received.filter((r) => r.path === dest.path)).toHaveLength(1);
  }, 30000);

  it('recovers a killed worker after receipt but before acknowledgement using the same idempotency key', async () => {
    const f = await fixture();
    const started = deferred();
    let first = true;
    const dest = await f.addDestination((_body, res) => {
      if (first) { first = false; started.resolve(); } // receipt without acknowledgement
      else res.end('recovered');
    }, 10000);
    const event = await f.ingest({ crash: true });
    const child = spawn(process.execPath, ['-r', 'ts-node/register', '-e',
      "require('reflect-metadata'); const {NestFactory}=require('@nestjs/core'); const {WorkerModule}=require('./src/worker/worker.module'); NestFactory.createApplicationContext(WorkerModule,{logger:false,abortOnError:false}).catch(()=>{process.exitCode=1;});"],
    { cwd: process.cwd(), env: { ...process.env, QUEUE_PREFIX: `crash-fixture-${randomUUID()}` }, stdio: 'ignore' });
    const exited = new Promise<void>((resolve, reject) => { child.once('exit', () => resolve()); child.once('error', reject); });
    let deadline: NodeJS.Timeout | undefined;
    try {
      await Promise.race([started.promise, new Promise<never>((_resolve, reject) => { deadline = setTimeout(() => reject(new Error('Crash fixture never received HTTP')), 20000); })]);
    } finally {
      clearTimeout(deadline);
      child.kill('SIGKILL'); // deliberate crash simulation, not a test-exit workaround
      await exited;
    }
    await admin.query("UPDATE outbox_messages SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [event.outbox.id]);
    await worker().sweepPendingOutbox();
    const sends = received.filter((r) => r.path === dest.path);
    expect(sends).toHaveLength(2);
    expect(sends[0]!.headers['idempotency-key']).toBe(sends[1]!.headers['idempotency-key']);
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
  }, 40000);

  it('recovers a committed successful attempt without resending after a coordinator crash', async () => {
    const f = await fixture();
    const second = await app.get(EndpointService).createEndpoint(f.org, f.user.id, { name: 'Second origin' });
    const dest = await f.addDestination((_body, res) => { res.end(); });
    const event = await f.ingest({ persisted: true }, second);
    const claimed = await workerDb.client.$queryRaw<{ id: string; lease_token: string }[]>`SELECT * FROM claim_pending_outbox_messages(1,30)`;
    const token = claimed.find((r) => r.id === event.outbox.id)!.lease_token;
    await workerDb.client.$queryRaw`SELECT * FROM prepare_destination_deliveries(${event.outbox.id}::uuid,${token}::uuid)`;
    await workerDb.client.$queryRaw`SELECT begin_destination_delivery(${event.outbox.id}::uuid,${dest.id}::uuid,${token}::uuid)`;
    // Real HTTP + durable attempt commit, but intentionally no coordinator result.
    const attempt = await app.get(DeliveryService).deliverEventToDestination({ organizationId: f.org,
      eventId: event.eventId, outboxMessageId: event.outbox.id, destination: { id: dest.id, url: dest.url },
      payload: { persisted: true }, eventType: 'reliability.test', attemptNumber: 1 });
    expect(attempt.status).toBe('SUCCESS');
    const sent = received.find((r) => r.path === dest.path)!;
    expect(sent.headers['x-relayforge-signature']).toBe(signWebhookPayload(sent.body, second.signingSecret, Number(sent.headers['x-relayforge-timestamp'])));
    await admin.query("UPDATE outbox_messages SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [event.outbox.id]);
    await worker().sweepPendingOutbox();
    expect(received.filter((r) => r.path === dest.path)).toHaveLength(1);
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
  });

  it('retains deleted destination state as an explicit DLQ failure', async () => {
    const f = await fixture();
    const dest = await f.addDestination((_body, res) => { res.statusCode = 500; res.end(); });
    const event = await f.ingest({ deleted: true });
    await worker().sweepPendingOutbox();
    await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.destination.delete({ where: { id: dest.id } }));
    await due(event.outbox.id);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DEAD_LETTER');
    expect((await f.targets(event.outbox.id))[0]!.lastError).toBe('Destination deleted or deactivated');
    expect(received.filter((r) => r.path === dest.path)).toHaveLength(1);
  });

  it('postpones a Redis-throttled target without burning its retry budget', async () => {
    const f = await fixture();
    const dest = await f.addDestination((_body, res) => { res.end(); });
    await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.destination.update({ where: { id: dest.id }, data: { rateLimitPerSecond: 1 } }));
    const event = await f.ingest({ limited: true });
    await app.get(RateLimiterService).checkRateLimit(dest.id, 1);
    await worker().sweepPendingOutbox();
    expect((await f.targets(event.outbox.id))[0]!.attemptCount).toBe(0);
    expect(received.filter((r) => r.path === dest.path)).toHaveLength(0);
    await delay(1100); // real Redis rate-limit window expiration
    await due(event.outbox.id);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect((await f.targets(event.outbox.id))[0]!.attemptCount).toBe(1);
  });

  it('drains a timed-out delivery and retains an ambiguous attempt in the DLQ', async () => {
    const f = await fixture();
    const started = deferred();
    await f.addDestination(() => { started.resolve(); }, 1000);
    const event = await f.ingest({ timeout: true });
    await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.outboxMessage.update({ where: { id: event.outbox.id }, data: { maxRetries: 1 } }));
    const live = worker();
    const sweep = live.sweepPendingOutbox();
    await started.promise;
    await live.onModuleDestroy();
    await sweep;
    expect((await f.state(event.outbox.id)).status).toBe('DEAD_LETTER');
    const attempts = await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.deliveryAttempt.findMany({ where: { eventId: event.eventId } }));
    expect(attempts.map((a) => a.status)).toEqual(['UNKNOWN']);
  });

  it('releases unfinished targets after partial graceful shutdown without repeating a success', async () => {
    const f = await fixture();
    const one = await f.addDestination((_body, res) => { res.end(); });
    const two = await f.addDestination((_body, res) => { res.end(); });
    const first = [one, two].sort((a, b) => a.id.localeCompare(b.id))[0]!;
    const started = deferred();
    const release = deferred();
    routes.set(first.path, (_body, res) => { started.resolve(); void release.promise.then(() => { res.end(); }); });
    const event = await f.ingest({ partialShutdown: true });
    const live = worker();
    const sweep = live.sweepPendingOutbox();
    await started.promise;
    const closing = live.onModuleDestroy();
    release.resolve();
    await closing;
    await sweep;
    expect((await f.state(event.outbox.id)).status).toBe('PENDING');
    expect((await f.state(event.outbox.id)).leaseToken).toBeNull();
    expect((await f.targets(event.outbox.id)).map((s) => s.attemptCount).sort()).toEqual([0, 1]);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect(received.filter((r) => r.path === first.path)).toHaveLength(1);
  });

  it('does not exhaust a destination budget because of coordinator claims or a temporarily unreadable signing secret', async () => {
    const f = await fixture();
    const dest = await f.addDestination((_body, res) => { res.end(); });
    const event = await f.ingest({ coordinator: true });
    const original = await admin.query<{ secret_ciphertext: string }>('SELECT secret_ciphertext FROM endpoints WHERE id=$1', [f.endpoint.endpoint.id]);
    await admin.query('UPDATE outbox_messages SET attempt_count=100 WHERE id=$1', [event.outbox.id]);
    await admin.query("UPDATE endpoints SET secret_ciphertext='invalid' WHERE id=$1", [f.endpoint.endpoint.id]);
    try {
      await worker().sweepPendingOutbox();
      expect((await f.state(event.outbox.id)).status).toBe('PENDING');
      expect((await f.targets(event.outbox.id))[0]!.attemptCount).toBe(0);
      expect(received.filter((r) => r.path === dest.path)).toHaveLength(0);
    } finally {
      await admin.query('UPDATE endpoints SET secret_ciphertext=$1 WHERE id=$2', [original.rows[0]!.secret_ciphertext, f.endpoint.endpoint.id]);
    }
    await due(event.outbox.id);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect((await f.targets(event.outbox.id))[0]!.attemptCount).toBe(1);
  });

  it('cancels in-flight HTTP after lease loss and rejects the stale result', async () => {
    const f = await fixture();
    const started = deferred();
    let first = true;
    const dest = await f.addDestination((_body, res) => {
      if (first) { first = false; started.resolve(); }
      else res.end('new owner');
    }, 20000);
    const event = await f.ingest({ leaseLoss: true });
    const sweep = worker().sweepPendingOutbox();
    await started.promise;
    await admin.query("UPDATE outbox_messages SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [event.outbox.id]);
    const successor = await workerDb.client.$queryRaw<{ id: string; lease_token: string }[]>`SELECT * FROM claim_pending_outbox_messages(1,30)`;
    const token = successor.find((r) => r.id === event.outbox.id)!.lease_token;
    await sweep; // the real heartbeat detects the replacement and cancels fetch
    expect((await f.state(event.outbox.id)).leaseToken).toBe(token);
    expect((await f.targets(event.outbox.id))[0]!.status).toBe('PENDING');
    const attempt = await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.deliveryAttempt.findFirstOrThrow({ where: { eventId: event.eventId } }));
    expect(attempt.status).toBe('UNKNOWN');
    expect(attempt.errorDescription).toContain('lease lost');
    await admin.query("UPDATE outbox_messages SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [event.outbox.id]);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect(received.filter((r) => r.path === dest.path)).toHaveLength(2);
  }, 30000);

  it('bulk-replays unfinished targets without repeating successful destinations', async () => {
    const f = await fixture();
    const good = await f.addDestination((_body, res) => { res.end(); });
    let status = 500;
    const bad = await f.addDestination((_body, res) => { res.statusCode = status; res.end(); });
    const event = await f.ingest({ bulk: true });
    await tenant.runInTenantContext(f.org, f.user.id, (tx) => tx.outboxMessage.update({ where: { id: event.outbox.id }, data: { maxRetries: 1 } }));
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DEAD_LETTER');
    status = 200;
    // Preserve the bulk endpoint's legacy FAILED eligibility as well as DLQ.
    await admin.query("UPDATE outbox_messages SET status='FAILED' WHERE id=$1", [event.outbox.id]);
    const replays = await Promise.all([0, 1].map(() => app.get(DlqService).bulkReplayDlq(f.org, f.user.id, [event.outbox.id, event.outbox.id])));
    expect(replays.reduce((count, r) => count + r.replayedCount, 0)).toBe(1);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('DISPATCHED');
    expect(received.filter((r) => r.path === good.path)).toHaveLength(1);
    expect(received.filter((r) => r.path === bad.path)).toHaveLength(2);
  });

  it('backfills a target budget from actual attempts, not a legacy coordinator ordinal', async () => {
    const f = await fixture();
    const dest = await f.addDestination((_body, res) => { res.statusCode = 500; res.end(); });
    const event = await f.ingest({ legacy: true });
    await app.get(DeliveryService).deliverEventToDestination({ organizationId: f.org, eventId: event.eventId,
      outboxMessageId: event.outbox.id, destination: { id: dest.id, url: dest.url }, payload: { legacy: true },
      eventType: 'reliability.test', attemptNumber: 4, signingSecret: f.endpoint.signingSecret });
    await admin.query('UPDATE outbox_messages SET attempt_count=4 WHERE id=$1', [event.outbox.id]);
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('PENDING');
    expect((await f.targets(event.outbox.id))[0]!.attemptCount).toBe(2);
  });
});
