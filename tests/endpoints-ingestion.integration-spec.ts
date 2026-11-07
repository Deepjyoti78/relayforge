import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { QueryResult } from 'pg';
import { Pool } from 'pg';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { computeHmacSignature, generateToken, hashToken } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';

interface EndpointResponse {
  endpoint: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    secretPreview: string;
    isActive: boolean;
  };
  signingSecret: string;
}

interface IngestResponse {
  eventId: string;
  status: 'accepted' | 'duplicate';
  receivedAt: string;
}

interface DbEventRow {
  id: string;
  org_id: string;
  endpoint_id: string;
  event_type: string;
  status: string;
}

interface DbOutboxRow {
  id: string;
  event_id: string;
  org_id: string;
  channel: string;
  status: string;
}

interface DbCountRow {
  count: string;
}

describe('Milestone 3 Phase 2 & 3: Endpoints, Signed Ingestion & Transactional Outbox (Integration)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let directApiPool: Pool;

  let userA: { id: string; email: string; cookie: string };
  let userB: { id: string; email: string; cookie: string };
  let userDev: { id: string; email: string; cookie: string };
  let userViewer: { id: string; email: string; cookie: string };

  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };

  let endpointA: { id: string; slug: string; signingSecret: string };

  beforeAll(async () => {
    app = await createApiApplication();
    database = app.get(DatabaseService);

    directApiPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
    });

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

    userA = await createUserWithSession('Owner A', `owner-a-${randomUUID()}@example.com`);
    userB = await createUserWithSession('Owner B', `owner-b-${randomUUID()}@example.com`);
    userDev = await createUserWithSession('Dev A', `dev-a-${randomUUID()}@example.com`);
    userViewer = await createUserWithSession('Viewer A', `viewer-a-${randomUUID()}@example.com`);

    // Create Org A
    const resA = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userA.cookie)
      .send({ name: 'Org A Ingestion' })
      .expect(201);
    orgA = resA.body as { id: string; name: string };

    // Add Dev and Viewer to Org A
    await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/members`)
      .set('Cookie', userA.cookie)
      .send({ email: userDev.email, role: 'DEVELOPER' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/members`)
      .set('Cookie', userA.cookie)
      .send({ email: userViewer.email, role: 'VIEWER' })
      .expect(201);

    // Create Org B
    const resB = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userB.cookie)
      .send({ name: 'Org B Ingestion' })
      .expect(201);
    orgB = resB.body as { id: string; name: string };
  });

  afterAll(async () => {
    await directApiPool.end();
    await app.close();
  });

  describe('Phase 2: Endpoint Management & AES-256-GCM Envelope Encryption', () => {
    it('allows DEVELOPER to create an endpoint with an encrypted secret', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/endpoints`)
        .set('Cookie', userDev.cookie)
        .send({ name: 'Stripe Webhooks', slug: 'stripe-webhooks' })
        .expect(201);

      const body = res.body as EndpointResponse;
      expect(body.endpoint.id).toBeDefined();
      expect(body.endpoint.name).toBe('Stripe Webhooks');
      expect(body.endpoint.slug).toBe('stripe-webhooks');
      expect(body.endpoint.secretPreview.startsWith('whsec_')).toBe(true);
      expect(body.signingSecret.startsWith('whsec_')).toBe(true);
      // Raw secret is never in the endpoint entity object
      expect((body.endpoint as Record<string, unknown>).secretCiphertext).toBeUndefined();

      endpointA = {
        id: body.endpoint.id,
        slug: body.endpoint.slug,
        signingSecret: body.signingSecret,
      };
    });

    it('blocks VIEWER role from creating an endpoint', async () => {
      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/endpoints`)
        .set('Cookie', userViewer.cookie)
        .send({ name: 'Unauthorized Endpoint' })
        .expect(403);
    });

    it('lists endpoints without exposing raw secrets, ciphertexts, or IVs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/endpoints`)
        .set('Cookie', userViewer.cookie)
        .expect(200);

      const list = res.body as Array<Record<string, unknown>>;
      expect(list.length).toBeGreaterThanOrEqual(1);
      const found = list.find((ep) => ep.id === endpointA.id);
      expect(found).toBeDefined();
      expect(found?.secretPreview).toBeDefined();
      expect(found?.signingSecret).toBeUndefined();
      expect(found?.secretCiphertext).toBeUndefined();
      expect(found?.secretIv).toBeUndefined();
    });

    it('enforces multi-tenant isolation: Org B cannot access Org A endpoints', async () => {
      expect(orgB.id).toBeDefined();

      // Org B user cannot view Org A endpoints
      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/endpoints`)
        .set('Cookie', userB.cookie)
        .expect(404);

      // Org B cannot delete Org A endpoint
      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgA.id}/endpoints/${endpointA.id}`)
        .set('Cookie', userB.cookie)
        .expect(404);
    });

    it('allows secret rotation and provides a new raw secret once', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/endpoints/${endpointA.id}/rotate-secret`)
        .set('Cookie', userA.cookie)
        .expect(201);

      const body = res.body as EndpointResponse;
      expect(body.signingSecret.startsWith('whsec_')).toBe(true);
      expect(body.signingSecret).not.toBe(endpointA.signingSecret);

      // Update test secret for Phase 3 ingestion
      endpointA.signingSecret = body.signingSecret;
    });
  });

  describe('Phase 3: Webhook Ingestion, HMAC Verification, Deduplication & Transactional Outbox', () => {
    const payload = {
      event: 'payment_intent.succeeded',
      data: {
        id: 'pi_3MtwBwLkdIwHu7ix28a3tqPa',
        amount: 4200,
        currency: 'usd',
      },
    };
    const rawPayload = JSON.stringify(payload);
    const idempotencyKey = `idemp-${randomUUID()}`;

    it('rejects webhooks with an invalid signature with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post(`/v1/ingest/${endpointA.id}`)
        .set('Content-Type', 'application/json')
        .set('X-RelayForge-Signature', 'bad_signature_hex_12345')
        .send(rawPayload)
        .expect(401);
    });

    it('accepts webhooks with valid HMAC-SHA256 signature and returns 202 Accepted', async () => {
      const signature = computeHmacSignature(rawPayload, endpointA.signingSecret);

      const res = await request(app.getHttpServer())
        .post(`/v1/ingest/${endpointA.id}`)
        .set('Content-Type', 'application/json')
        .set('X-RelayForge-Signature', signature)
        .set('X-Idempotency-Key', idempotencyKey)
        .set('X-Event-Type', 'payment.succeeded')
        .send(rawPayload)
        .expect(202);

      const body = res.body as IngestResponse;
      expect(body.eventId).toBeDefined();
      expect(body.status).toBe('accepted');
      expect(body.receivedAt).toBeDefined();

      // Verify Transactional Outbox Pattern in database:
      // Both event and outbox_message exist and are tied together
      const client = await directApiPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgA.id]);

        const eventResult: QueryResult<DbEventRow> = await client.query(
          'SELECT * FROM events WHERE id = $1',
          [body.eventId],
        );
        expect(eventResult.rows.length).toBe(1);
        const row = eventResult.rows[0];
        expect(row?.event_type).toBe('payment.succeeded');
        expect(row?.status).toBe('RECEIVED');

        const outboxResult: QueryResult<DbOutboxRow> = await client.query(
          'SELECT * FROM outbox_messages WHERE event_id = $1',
          [body.eventId],
        );
        expect(outboxResult.rows.length).toBe(1);
        const outboxRow = outboxResult.rows[0];
        expect(outboxRow?.status).toBe('PENDING');
        expect(outboxRow?.channel).toBe('events');

        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    it('deduplicates identical requests with the same idempotency key (idempotency guarantee)', async () => {
      const signature = computeHmacSignature(rawPayload, endpointA.signingSecret);

      // Re-send the exact same webhook and idempotency key
      const res = await request(app.getHttpServer())
        .post(`/v1/ingest/${endpointA.id}`)
        .set('Content-Type', 'application/json')
        .set('X-RelayForge-Signature', signature)
        .set('X-Idempotency-Key', idempotencyKey)
        .send(rawPayload)
        .expect(200);

      const body = res.body as IngestResponse;
      expect(body.status).toBe('duplicate');

      // Verify no duplicate outbox message or event was created
      const client = await directApiPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgA.id]);

        const outboxCount: QueryResult<DbCountRow> = await client.query(
          'SELECT COUNT(*) FROM outbox_messages WHERE event_id = $1',
          [body.eventId],
        );
        const countRow = outboxCount.rows[0];
        expect(countRow).toBeDefined();
        expect(parseInt(countRow?.count ?? '0', 10)).toBe(1);

        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });

    it('accepts timestamped signature header (t=...,v1=...)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const testPayload = JSON.stringify({ event: 'charge.captured' });
      const signature = computeHmacSignature(`${now}.${testPayload}`, endpointA.signingSecret);
      const header = `t=${now},v1=${signature}`;

      const res = await request(app.getHttpServer())
        .post(`/v1/ingest/${endpointA.id}`)
        .set('Content-Type', 'application/json')
        .set('X-RelayForge-Signature', header)
        .send(testPayload)
        .expect(202);

      const body = res.body as IngestResponse;
      expect(body.status).toBe('accepted');
    });

    it('returns 404 for ingestion to a non-existent endpoint', async () => {
      const nonExistentId = randomUUID();
      await request(app.getHttpServer())
        .post(`/v1/ingest/${nonExistentId}`)
        .set('Content-Type', 'application/json')
        .send({ test: true })
        .expect(404);
    });
  });
});
