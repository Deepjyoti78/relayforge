import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import { SessionService } from '../src/modules/auth/session.service';
import { RuntimeConfig } from '../src/modules/config/config.module';
import { TenantContextService } from '../src/modules/database/tenant-context.service';
import { TelemetryController } from '../src/modules/observability/telemetry.controller';
import { MetricsService } from '../src/modules/observability/metrics.service';
import { EventStreamService } from '../src/modules/observability/event-stream.service';

// Exercises real HTTP routing and guards without requiring PostgreSQL or Redis.
describe('SSE organization authorization over HTTP', () => {
  let app: INestApplication;
  let member: boolean;
  const stream = jest.fn(() => of({ data: { organizationId: 'org-1' } }));
  const findUnique = jest.fn(() => Promise.resolve(member ? { role: 'VIEWER' } : null));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [AuthGuard, AuthorizationService,
        { provide: RuntimeConfig, useValue: { values: { sessionCookieName: 'rf_session' } } },
        { provide: SessionService, useValue: { validateSession: (token: string) =>
          Promise.resolve(token === 'valid' ? { user: { id: 'user-1' }, session: {} } : null) } },
        { provide: MetricsService, useValue: {} },
        { provide: EventStreamService, useValue: { getStreamForOrganization: stream } },
        { provide: TenantContextService, useValue: {
          runInTenantContext: (_org: string, _user: string, operation: (tx: unknown) => unknown) =>
            operation({ membership: { findUnique } }),
        } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { member = false; });
  describe.each(['events/stream', 'telemetry/events/stream'])('%s', (path) => {
    it('rejects unauthenticated clients', async () => {
      await request(app.getHttpServer() as Server).get(`/v1/organizations/org-1/${path}`).expect(401);
      expect(stream).not.toHaveBeenCalled();
    });
    it('rejects authenticated nonmembers before opening a stream', async () => {
      await request(app.getHttpServer() as Server).get(`/v1/organizations/org-1/${path}`)
        .set('Cookie', 'rf_session=valid').expect(403);
      expect(stream).not.toHaveBeenCalled();
    });
    it('allows viewer members', async () => {
      member = true;
      const res = await request(app.getHttpServer() as Server).get(`/v1/organizations/org-1/${path}`)
        .set('Cookie', 'rf_session=valid').expect(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(findUnique).toHaveBeenCalledWith({ where: {
        organizationId_userId: { organizationId: 'org-1', userId: 'user-1' },
      } });
      expect(stream).toHaveBeenCalledWith('org-1');
    });
  });
});
