import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
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
    const response = await request(app.getHttpServer()).post('/v1/organizations').set('Cookie', `rf_session=${token}`)
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
    return { org, user, endpoint, addDestination, ingest, state };
  }

  it('keeps a mixed 200/500 event pending and retries only the failed destination', async () => {
    const f = await fixture();
    const good = await f.addDestination((_body, res) => { res.end('ok'); });
    const bad = await f.addDestination((_body, res) => { res.statusCode = 500; res.end('retry'); });
    const event = await f.ingest({ mixed: randomUUID() });
    await worker().sweepPendingOutbox();
    expect((await f.state(event.outbox.id)).status).toBe('PENDING');
    expect(received.filter((r) => r.path === good.path)).toHaveLength(1);
    expect(received.filter((r) => r.path === bad.path)).toHaveLength(1);

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

});
