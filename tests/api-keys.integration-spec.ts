import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { generateToken, hashToken } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';

interface ApiKeyPayload {
  apiKey: string;
  record: {
    id: string;
    organizationId: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    revokedAt: string | null;
  };
}

interface DbApiKeyRow {
  id: string;
  org_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
}

describe('Milestone 3 — API Key Management & RLS Tenant Isolation (Integration)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let directApiPool: Pool;

  // Test users
  let userA: { id: string; email: string; cookie: string };
  let userB: { id: string; email: string; cookie: string };
  let userDev: { id: string; email: string; cookie: string };
  let userViewer: { id: string; email: string; cookie: string };

  // Test organizations
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };

  let createdApiKeyA: string;
  let apiKeyRecordA: { id: string };

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

    // Create Org A with Owner A
    const resA = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userA.cookie)
      .send({ name: 'Org A Ingestion' })
      .expect(201);
    orgA = resA.body as { id: string; name: string };

    // Add Dev A and Viewer A to Org A
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

    // Create Org B with Owner B
    const resB = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userB.cookie)
      .send({ name: 'Org B Isolated' })
      .expect(201);
    orgB = resB.body as { id: string; name: string };
  });

  afterAll(async () => {
    await directApiPool.end();
    await app.close();
  });

  it('Owner A can create an API key for Org A', async () => {
    expect(orgB.id).toBeDefined();

    const res = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/api-keys`)
      .set('Cookie', userA.cookie)
      .send({ name: 'Production Ingest Key', scopes: ['ingest'] })
      .expect(201);

    const body = res.body as ApiKeyPayload;
    expect(body.apiKey).toMatch(/^rf_live_/);
    expect(body.record.name).toBe('Production Ingest Key');
    expect(body.record.scopes).toEqual(['ingest']);
    expect(body.record.keyPrefix).toMatch(/^rf_live_/);

    createdApiKeyA = body.apiKey;
    apiKeyRecordA = body.record;

    // Verify the raw key is NOT stored in the database (only SHA-256 hash) within tenant context
    const client = await directApiPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT set_config('app.current_user_id', $1, true), set_config('app.current_org_id', $2, true)",
        [userA.id, orgA.id],
      );
      const direct = await client.query<DbApiKeyRow>(
        'SELECT key_hash, key_prefix FROM api_keys WHERE id = $1',
        [apiKeyRecordA.id],
      );
      expect(direct.rows[0]?.key_hash).toBe(hashToken(createdApiKeyA));
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  it('Owner A can list API keys for Org A (masked previews)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/api-keys`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const body = res.body as Array<{ id: string; keyPrefix: string; name: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((k) => k.id === apiKeyRecordA.id)).toBe(true);
    // Raw key must never be returned in listing
    expect((body[0] as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it('Developer A can create and list API keys for Org A', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/api-keys`)
      .set('Cookie', userDev.cookie)
      .send({ name: 'Dev Team Key' })
      .expect(201);

    const body = res.body as ApiKeyPayload;
    expect(body.apiKey).toMatch(/^rf_live_/);
    expect(body.record.name).toBe('Dev Team Key');
  });

  it('Viewer A CANNOT create API keys (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/api-keys`)
      .set('Cookie', userViewer.cookie)
      .send({ name: 'Unauthorized Viewer Key' })
      .expect(403);
  });

  it('Cross-tenant isolation: User B cannot view or access Org A API keys', async () => {
    // User B attempts to list Org A's API keys -> 404
    await request(app.getHttpServer())
      .get(`/v1/organizations/${orgA.id}/api-keys`)
      .set('Cookie', userB.cookie)
      .expect(404);

    // User B attempts to revoke Org A's API key -> 404
    await request(app.getHttpServer())
      .delete(`/v1/organizations/${orgA.id}/api-keys/${apiKeyRecordA.id}`)
      .set('Cookie', userB.cookie)
      .expect(404);
  });

  it('PostgreSQL RLS blocks direct cross-tenant API key enumeration without tenant context', async () => {
    // Direct SELECT on api_keys without app.current_org_id returns 0 rows due to RLS
    const client = await directApiPool.connect();
    try {
      const res = await client.query('SELECT * FROM api_keys');
      expect(res.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });

  it('verify_api_key() security definer function authenticates valid active key by hash', async () => {
    const client = await directApiPool.connect();
    try {
      const hash = hashToken(createdApiKeyA);
      const res = await client.query<DbApiKeyRow>('SELECT * FROM verify_api_key($1)', [hash]);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0]?.id).toBe(apiKeyRecordA.id);
      expect(res.rows[0]?.org_id).toBe(orgA.id);
      expect(res.rows[0]?.name).toBe('Production Ingest Key');
    } finally {
      client.release();
    }
  });

  it('Owner A can revoke an API key and verify_api_key returns null', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/organizations/${orgA.id}/api-keys/${apiKeyRecordA.id}`)
      .set('Cookie', userA.cookie)
      .expect(200);

    const body = res.body as { id: string; revokedAt: string | null };
    expect(body.id).toBe(apiKeyRecordA.id);
    expect(body.revokedAt).not.toBeNull();

    // Verify verify_api_key now returns 0 rows for the revoked key
    const client = await directApiPool.connect();
    try {
      const hash = hashToken(createdApiKeyA);
      const check = await client.query('SELECT * FROM verify_api_key($1)', [hash]);
      expect(check.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });
});
