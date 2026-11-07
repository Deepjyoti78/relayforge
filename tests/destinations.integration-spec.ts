import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { serializeCookie } from '../src/common/cookies';
import { generateToken, hashToken } from '../src/common/crypto';
import { DatabaseService } from '../src/modules/database/database.service';

interface DestinationResponse {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  httpMethod: string;
  headers: Record<string, string> | null;
  rateLimitPerSecond: number;
  timeoutMs: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

describe('Milestone 3 Option 1: Destination Registry & SSRF Protection (Integration)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;

  let userA: { id: string; email: string; cookie: string };
  let userB: { id: string; email: string; cookie: string };
  let userDevA: { id: string; email: string; cookie: string };
  let userViewerA: { id: string; email: string; cookie: string };

  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };

  beforeAll(async () => {
    app = await createApiApplication();
    database = app.get(DatabaseService);

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

    userA = await createUserWithSession('Owner A', `dest-owner-a-${randomUUID()}@example.com`);
    userB = await createUserWithSession('Owner B', `dest-owner-b-${randomUUID()}@example.com`);
    userDevA = await createUserWithSession('Developer A', `dest-dev-a-${randomUUID()}@example.com`);
    userViewerA = await createUserWithSession('Viewer A', `dest-viewer-a-${randomUUID()}@example.com`);

    // Create Org A
    const resA = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userA.cookie)
      .send({ name: 'Acme Corp Org A', slug: `acme-dest-a-${randomUUID().slice(0, 8)}` })
      .expect(201);
    orgA = resA.body as { id: string; name: string };

    // Create Org B
    const resB = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Cookie', userB.cookie)
      .send({ name: 'Beta Corp Org B', slug: `beta-dest-b-${randomUUID().slice(0, 8)}` })
      .expect(201);
    orgB = resB.body as { id: string; name: string };

    // Add userDevA to Org A with DEVELOPER role
    await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/members`)
      .set('Cookie', userA.cookie)
      .send({ email: userDevA.email, role: 'DEVELOPER' })
      .expect(201);

    // Add userViewerA to Org A with VIEWER role
    await request(app.getHttpServer())
      .post(`/v1/organizations/${orgA.id}/members`)
      .set('Cookie', userA.cookie)
      .send({ email: userViewerA.email, role: 'VIEWER' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Destination Creation & SSRF Defense', () => {
    it('blocks SSRF loopback URLs when creating a destination', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'Malicious Loopback Target',
          url: 'http://127.0.0.1:8080/internal-admin',
        })
        .expect(400);

      expect((res.body as { message: string }).message).toMatch(/blocked private or loopback/);
    });

    it('blocks SSRF private RFC 1918 IPv4 ranges', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'Malicious Private Network Target',
          url: 'http://192.168.1.100:3000/keys',
        })
        .expect(400);

      expect((res.body as { message: string }).message).toMatch(/blocked private or loopback/);
    });

    it('blocks SSRF cloud metadata IP address', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'Cloud Metadata Exploit',
          url: 'http://169.254.169.254/latest/meta-data/',
        })
        .expect(400);

      expect((res.body as { message: string }).message).toMatch(/SSRF security policy|blocked private/);
    });

    it('blocks non-HTTP protocols (e.g. file://, ftp://)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'File Exfiltration',
          url: 'file:///etc/passwd',
        })
        .expect(400);

      expect((res.body as { message: string }).message).toMatch(/Invalid protocol/);
    });

    it('creates a destination successfully with a valid public URL', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'Production Stripe Webhook Target',
          url: 'https://httpbin.org/post',
          httpMethod: 'POST',
          headers: { 'X-RelayForge-Org': 'Acme' },
          rateLimitPerSecond: 100,
          timeoutMs: 5000,
        })
        .expect(201);

      const body = res.body as DestinationResponse;
      expect(body.id).toBeDefined();
      expect(body.organizationId).toBe(orgA.id);
      expect(body.name).toBe('Production Stripe Webhook Target');
      expect(body.url).toBe('https://httpbin.org/post');
      expect(body.rateLimitPerSecond).toBe(100);
      expect(body.timeoutMs).toBe(5000);
      expect(body.isActive).toBe(true);
    });

    it('allows a DEVELOPER in Org A to create a destination', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userDevA.cookie)
        .send({
          name: 'Developer Created Target',
          url: 'https://httpbin.org/anything',
        })
        .expect(201);

      const body = res.body as DestinationResponse;
      expect(body.name).toBe('Developer Created Target');
    });

    it('forbids a VIEWER from creating a destination (RBAC check)', async () => {
      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userViewerA.cookie)
        .send({
          name: 'Viewer Target',
          url: 'https://httpbin.org/post',
        })
        .expect(403);
    });
  });

  describe('Multi-Tenant Row-Level Security Isolation', () => {
    let destinationAId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'Org A Dedicated Target',
          url: 'https://httpbin.org/post',
        })
        .expect(201);
      destinationAId = (res.body as DestinationResponse).id;
    });

    it('allows Org A members to list Org A destinations', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userA.cookie)
        .expect(200);

      const list = res.body as DestinationResponse[];
      expect(list.some((d) => d.id === destinationAId)).toBe(true);
    });

    it('strictly isolates destinations: Org B cannot see Org A destinations', async () => {
      // User B listing their own org should not see Org A destinations
      const resB = await request(app.getHttpServer())
        .get(`/v1/organizations/${orgB.id}/destinations`)
        .set('Cookie', userB.cookie)
        .expect(200);

      const listB = resB.body as DestinationResponse[];
      expect(listB.some((d) => d.id === destinationAId)).toBe(false);

      // User B querying Org A directly is denied
      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/destinations`)
        .set('Cookie', userB.cookie)
        .expect(404);
    });

    it('prevents Org B from updating or deleting Org A destinations', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgA.id}/destinations/${destinationAId}`)
        .set('Cookie', userB.cookie)
        .send({ name: 'Tampered by Org B' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgA.id}/destinations/${destinationAId}`)
        .set('Cookie', userB.cookie)
        .expect(404);
    });

    it('allows updating destination properties (rate limit, timeout, active status)', async () => {
      const updateRes = await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgA.id}/destinations/${destinationAId}`)
        .set('Cookie', userA.cookie)
        .send({
          name: 'Updated Org A Target',
          rateLimitPerSecond: 250,
          isActive: false,
        })
        .expect(200);

      const body = updateRes.body as DestinationResponse;
      expect(body.name).toBe('Updated Org A Target');
      expect(body.rateLimitPerSecond).toBe(250);
      expect(body.isActive).toBe(false);
    });

    it('allows deleting destination by OWNER or DEVELOPER', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgA.id}/destinations/${destinationAId}`)
        .set('Cookie', userA.cookie)
        .expect(200);

      // Verify it is gone
      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgA.id}/destinations/${destinationAId}`)
        .set('Cookie', userA.cookie)
        .expect(404);
    });
  });
});
