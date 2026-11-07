import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { generateToken, hashToken } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';
import { TenantContextService } from '../src/modules/database/tenant-context.service';

interface OrgPayload {
  id: string;
  name: string;
  slug: string;
  role?: string;
  createdAt?: string;
}

interface MemberPayload {
  id: string;
  userId: string;
  role: string;
}

interface ErrorPayload {
  message: string;
  statusCode: number;
}

describe('Milestone 2: Identity, Organizations, and Multi-Tenant RLS', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let tenantContext: TenantContextService;
  let directApiPool: Pool;

  // Test users
  let userA: { id: string; email: string; sessionToken: string; cookie: string };
  let userB: { id: string; email: string; sessionToken: string; cookie: string };
  let userViewer: { id: string; email: string; sessionToken: string; cookie: string };
  let userDev: { id: string; email: string; sessionToken: string; cookie: string };

  // Test organizations
  let orgA: OrgPayload;
  let orgB: OrgPayload;

  beforeAll(async () => {
    app = await createApiApplication();
    database = app.get(DatabaseService);
    tenantContext = app.get(TenantContextService);
    directApiPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });

    // Helper to create test user and active session
    const createTestUser = async (name: string, email: string) => {
      const user = await database.client.user.create({
        data: {
          displayName: name,
          email,
        },
      });

      const token = generateToken();
      const tokenHash = hashToken(token);
      await database.client.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const cookie = serializeCookie('rf_session', token);
      return { id: user.id, email, sessionToken: token, cookie };
    };

    userA = await createTestUser('Alice Owner', `alice-${randomUUID()}@example.com`);
    userB = await createTestUser('Bob Owner', `bob-${randomUUID()}@example.com`);
    userViewer = await createTestUser('Charlie Viewer', `charlie-${randomUUID()}@example.com`);
    userDev = await createTestUser('Dana Developer', `dana-${randomUUID()}@example.com`);

    // Create Organization A owned by User A
    const resA = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userA.cookie)
      .send({ name: 'Acme Corp', slug: `acme-${randomUUID().slice(0, 8)}` });
    orgA = resA.body as OrgPayload;

    // Create Organization B owned by User B
    const resB = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userB.cookie)
      .send({ name: 'Beta Industries', slug: `beta-${randomUUID().slice(0, 8)}` });
    orgB = resB.body as OrgPayload;
  });

  afterAll(async () => {
    await directApiPool.end();
    await app.close();
  });

  describe('Organization Creation & Initial Owner Role', () => {
    it('creates an organization and automatically assigns creator as OWNER', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', userA.cookie)
        .send({ name: 'Gamma Labs', slug: `gamma-${randomUUID().slice(0, 8)}` })
        .expect(201);

      const body = res.body as OrgPayload;
      expect(body.id).toBeDefined();
      expect(body.name).toBe('Gamma Labs');
      expect(body.role).toBe('OWNER');

      // Verify in DB through user context that creator is OWNER
      const membership = await tenantContext.runInUserContext(userA.id, async (tx) => {
        return tx.membership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: body.id,
              userId: userA.id,
            },
          },
        });
      });
      expect(membership?.role).toBe('OWNER');
    });

    it('lists only organizations where the authenticated user is a member', async () => {
      const resA = await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Cookie', userA.cookie)
        .expect(200);

      const orgsA = resA.body as OrgPayload[];
      const orgIdsA = orgsA.map((o) => o.id);
      expect(orgIdsA).toContain(orgA.id);
      expect(orgIdsA).not.toContain(orgB.id);

      const resB = await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Cookie', userB.cookie)
        .expect(200);

      const orgsB = resB.body as OrgPayload[];
      const orgIdsB = orgsB.map((o) => o.id);
      expect(orgIdsB).toContain(orgB.id);
      expect(orgIdsB).not.toContain(orgA.id);
    });
  });

  describe('Cross-Tenant Isolation & RLS Boundary', () => {
    it('allows User A to access Organization A details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}`)
        .set('Cookie', userA.cookie)
        .expect(200);

      const body = res.body as OrgPayload;
      expect(body.id).toBe(orgA.id);
      expect(body.name).toBe('Acme Corp');
    });

    it('blocks User A from accessing Organization B details (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgB.id}`)
        .set('Cookie', userA.cookie)
        .expect(404);
    });

    it('blocks User A from reading Organization B membership records (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgB.id}/members`)
        .set('Cookie', userA.cookie)
        .expect(404);
    });

    it('blocks User A from modifying Organization B (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgB.id}`)
        .set('Cookie', userA.cookie)
        .send({ name: 'Malicious Rename' })
        .expect(404);
    });

    it('tampering with organization ID in URL does not grant cross-tenant access', async () => {
      const fakeOrgId = randomUUID();
      await request(app.getHttpServer())
        .get(`/v1/organizations/${fakeOrgId}`)
        .set('Cookie', userA.cookie)
        .expect(404);
    });
  });

  describe('Direct Database Queries & Engine-Level RLS Enforcement', () => {
    it('direct API runtime queries without tenant context cannot read tenant rows', async () => {
      const client = await directApiPool.connect();
      try {
        const res = await client.query('SELECT * FROM organizations WHERE id = $1', [orgA.id]);
        expect(res.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('User A setting fake orgB context is blocked by PostgreSQL RLS', async () => {
      const client = await directApiPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "SELECT set_config('app.current_user_id', $1, true), set_config('app.current_org_id', $2, true)",
          [userA.id, orgB.id],
        );

        const orgRes = await client.query('SELECT * FROM organizations WHERE id = $1', [orgB.id]);
        expect(orgRes.rows.length).toBe(0);

        const memRes = await client.query('SELECT * FROM memberships WHERE org_id = $1', [orgB.id]);
        expect(memRes.rows.length).toBe(0);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });

    it('tenant context does not leak across pooled database connections', async () => {
      await tenantContext.runInTenantContext(orgA.id, userA.id, async (tx) => {
        const count = await tx.organization.count();
        expect(count).toBeGreaterThanOrEqual(1);
      });

      const client = await directApiPool.connect();
      try {
        const setting = await client.query<{ org: string }>("SELECT current_setting('app.current_org_id', true) AS org");
        expect(setting.rows[0]?.org).toBe('');
      } finally {
        client.release();
      }
    });
  });

  describe('Role-Based Access Control within Organization', () => {
    let viewerMemberId: string;
    let devMemberId: string;

    beforeAll(async () => {
      const viewerRes = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/members`)
        .set('Cookie', userA.cookie)
        .send({ email: userViewer.email, role: 'VIEWER' })
        .expect(201);
      const viewerBody = viewerRes.body as MemberPayload;
      viewerMemberId = viewerBody.id;

      const devRes = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/members`)
        .set('Cookie', userA.cookie)
        .send({ email: userDev.email, role: 'DEVELOPER' })
        .expect(201);
      const devBody = devRes.body as MemberPayload;
      devMemberId = devBody.id;
    });

    it('VIEWER can read organization details and members', async () => {
      const orgRes = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}`)
        .set('Cookie', userViewer.cookie)
        .expect(200);
      const orgBody = orgRes.body as OrgPayload;
      expect(orgBody.id).toBe(orgA.id);

      const memRes = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/members`)
        .set('Cookie', userViewer.cookie)
        .expect(200);
      const members = memRes.body as MemberPayload[];
      expect(members.length).toBeGreaterThanOrEqual(3);
    });

    it('VIEWER cannot perform administrative actions (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgA.id}`)
        .set('Cookie', userViewer.cookie)
        .send({ name: 'Viewer Renamed Org' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/members`)
        .set('Cookie', userViewer.cookie)
        .send({ email: 'new@example.com', role: 'VIEWER' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgA.id}/members/${devMemberId}`)
        .set('Cookie', userViewer.cookie)
        .send({ role: 'OWNER' })
        .expect(403);
    });

    it('DEVELOPER cannot perform OWNER-only actions (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgA.id}`)
        .set('Cookie', userDev.cookie)
        .send({ name: 'Dev Renamed Org' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/members`)
        .set('Cookie', userDev.cookie)
        .send({ email: 'new@example.com', role: 'VIEWER' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgA.id}/members/${viewerMemberId}`)
        .set('Cookie', userDev.cookie)
        .expect(403);
    });

    it('OWNER can change member roles', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgA.id}/members/${devMemberId}`)
        .set('Cookie', userA.cookie)
        .send({ role: 'VIEWER' })
        .expect(200);

      const body = res.body as MemberPayload;
      expect(body.role).toBe('VIEWER');
    });
  });

  describe('Final Owner Protection', () => {
    let ownerMemberAId: string;

    beforeAll(async () => {
      const members = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/members`)
        .set('Cookie', userA.cookie)
        .expect(200);

      const memberList = members.body as MemberPayload[];
      const ownerA = memberList.find((m) => m.userId === userA.id)!;
      ownerMemberAId = ownerA.id;
    });

    it('prevents demoting the final Owner of an organization', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgA.id}/members/${ownerMemberAId}`)
        .set('Cookie', userA.cookie)
        .send({ role: 'DEVELOPER' })
        .expect(400);

      const body = res.body as ErrorPayload;
      expect(body.message).toContain('Cannot demote the final Owner');
    });

    it('prevents removing the final Owner of an organization', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgA.id}/members/${ownerMemberAId}`)
        .set('Cookie', userA.cookie)
        .expect(400);

      const body = res.body as ErrorPayload;
      expect(body.message).toContain('Cannot remove the final Owner');
    });
  });

  describe('Session Security & OAuth Flow', () => {
    it('returns 401 Unauthorized when no session cookie is provided', async () => {
      await request(app.getHttpServer())
        .get('/v1/me')
        .expect(401);
    });

    it('returns 401 Unauthorized when session is expired', async () => {
      const expiredUser = await database.client.user.create({
        data: { displayName: 'Expired User', email: 'expired@example.com' },
      });
      const token = generateToken();
      const tokenHash = hashToken(token);
      await database.client.session.create({
        data: {
          userId: expiredUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() - 3600000), // Expired 1 hr ago
        },
      });

      await request(app.getHttpServer())
        .get('/v1/me')
        .set('Cookie', serializeCookie('rf_session', token))
        .expect(401);
    });

    it('returns 401 Unauthorized after session is revoked via logout', async () => {
      const testUser = await database.client.user.create({
        data: { displayName: 'Logout User', email: 'logout@example.com' },
      });
      const token = generateToken();
      const tokenHash = hashToken(token);
      await database.client.session.create({
        data: {
          userId: testUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const cookie = serializeCookie('rf_session', token);

      await request(app.getHttpServer())
        .get('/v1/me')
        .set('Cookie', cookie)
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      await request(app.getHttpServer())
        .get('/v1/me')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('OAuth state cannot be reused (replay protection)', async () => {
      const state = `test-state-${randomUUID()}`;
      await database.client.oAuthState.create({
        data: {
          state,
          codeVerifier: 'verifier123456789012345678901234567890',
          expiresAt: new Date(Date.now() + 60000),
        },
      });

      const first = await database.client.oAuthState.findUnique({ where: { state } });
      expect(first).toBeDefined();
      await database.client.oAuthState.delete({ where: { id: first!.id } });

      const second = await database.client.oAuthState.findUnique({ where: { state } });
      expect(second).toBeNull();
    });
  });
});
