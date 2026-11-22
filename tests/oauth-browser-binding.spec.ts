import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { SessionService } from '../src/modules/auth/session.service';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';
import { GitHubOAuthService } from '../src/modules/auth/github-oauth.service';
import { RuntimeConfig } from '../src/modules/config/config.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { TenantContextService } from '../src/modules/database/tenant-context.service';
import { generateState } from '../src/common/crypto';

// Only provider exchange and persistence are mocked; HTTP routing/cookies are real.
describe('Browser-bound OAuth callbacks', () => {
  let app: INestApplication;
  const session = { createSession: jest.fn().mockResolvedValue({ token: 'session-secret', session: { expiresAt: new Date(Date.now() + 60000) } }) };
  const providers = {
    google: { createAuthorizationUrl: jest.fn(), handleCallback: jest.fn() },
    github: { createAuthorizationUrl: jest.fn(), handleCallback: jest.fn() },
  };
  const states = new Set<string>();
  const discardState = jest.fn((args: { where: { state: string } }) => Promise.resolve({ count: states.delete(args.where.state) ? 1 : 0 }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [
      AuthGuard,
      { provide: SessionService, useValue: session },
      { provide: GoogleOAuthService, useValue: providers.google },
      { provide: GitHubOAuthService, useValue: providers.github },
      { provide: RuntimeConfig, useValue: { values: { frontendUrl: 'http://localhost:5173', environment: 'test', sessionCookieName: 'rf_session' } } },
      { provide: DatabaseService, useValue: { client: { oAuthState: { deleteMany: discardState } } } }, { provide: TenantContextService, useValue: {} },
    ] }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    states.clear();
    for (const provider of Object.values(providers)) {
      provider.createAuthorizationUrl.mockImplementation(() => {
        const state = generateState(); states.add(state);
        return Promise.resolve({ state, url: 'https://provider.example/authorize?state=' + state });
      });
      provider.handleCallback.mockImplementation((_code: string, state: string) => {
        if (!states.delete(state)) return Promise.reject(new Error('Invalid state'));
        return Promise.resolve({ user: { id: 'user-1' }, redirectUri: 'http://localhost:5173' });
      });
    }
  });
  describe.each(['google', 'github'] as const)('%s', (provider) => {
    async function start() {
      const res = await request(app.getHttpServer() as Server).get('/auth/' + provider + '/start').expect(302);
      return { state: new URL(String(res.headers.location)).searchParams.get('state')!, cookies: res.headers['set-cookie'] as unknown as string[] };
    }
    it('creates an HttpOnly Lax browser-binding cookie and disables caching', async () => {
      const started = await start();
      expect(started.cookies?.join(';')).toContain('HttpOnly');
      expect(started.cookies?.join(';')).toContain('SameSite=Lax');
    });
    it('rejects a stolen state in a different browser before exchange', async () => {
      const { state } = await start();
      const res = await request(app.getHttpServer() as Server).get('/auth/' + provider + '/callback').query({ code: 'code', state }).expect(302);
      expect(res.headers.location).toContain('error=');
      expect(providers[provider].handleCallback).not.toHaveBeenCalled();
      expect(session.createSession).not.toHaveBeenCalled();
    });
    it('rejects mismatched and other-provider cookies', async () => {
      const a = await start(); const b = await start();
      expect(b.cookies).toBeDefined();
      for (const cookie of [b.cookies?.join(';') ?? '', 'rf_session_oauth_' + (provider === 'google' ? 'github' : 'google') + '=' + a.state]) {
        await request(app.getHttpServer() as Server).get('/auth/' + provider + '/callback')
          .set('Cookie', cookie).query({ code: 'code', state: a.state }).expect(302);
        expect(providers[provider].handleCallback).not.toHaveBeenCalled();
      }
    });
    it('accepts the initiating browser once and clears the binding cookie', async () => {
      const { state, cookies } = await start();
      const callback = () => request(app.getHttpServer() as Server).get('/auth/' + provider + '/callback')
        .set('Cookie', cookies?.join(';') ?? '').query({ code: 'code', state });
      const res = await callback().expect(302);
      expect(res.headers.location).toBe('http://localhost:5173');
      const setCookies = res.headers['set-cookie'] as unknown as string[];
      expect(setCookies.some((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
      expect(setCookies.some((cookie) => cookie.includes('rf_session=session-secret'))).toBe(true);
      expect(res.headers['cache-control']).toBe('no-store');
      await callback().expect(302);
      expect(session.createSession).toHaveBeenCalledTimes(1);
    });
    it('clears matching state on provider denial without reflecting descriptions', async () => {
      const { state, cookies } = await start();
      const res = await request(app.getHttpServer() as Server).get('/auth/' + provider + '/callback')
        .set('Cookie', cookies?.join(';') ?? '').query({ error: 'access_denied', error_description: 'sensitive', state }).expect(302);
      expect((res.headers['set-cookie'] as unknown as string[])?.some((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
      expect(res.headers.location).not.toContain('sensitive');
      expect(discardState).toHaveBeenCalledWith({ where: { state } });
      expect(session.createSession).not.toHaveBeenCalled();
    });
  });
});
