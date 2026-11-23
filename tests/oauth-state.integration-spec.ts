import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApiApplication } from '../src/api/create-api';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';
import { GitHubOAuthService } from '../src/modules/auth/github-oauth.service';
import { DatabaseService } from '../src/modules/database/database.service';
import { RuntimeConfig } from '../src/modules/config/config.module';
import { oauthStateCookie } from '../src/modules/auth/auth-cookies';

describe('OAuth state expiry in PostgreSQL', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await createApiApplication(); });
  afterAll(async () => { await app?.close(); });
  it.each(['google', 'github'] as const)('%s rejects expired browser-bound state before provider exchange', async (provider) => {
    const service = provider === 'google' ? app.get(GoogleOAuthService) : app.get(GitHubOAuthService);
    const config = app.get(RuntimeConfig).values;
    const { state } = await service.createAuthorizationUrl(config.frontendUrl);
    await app.get(DatabaseService).client.oAuthState.update({ where: { state }, data: { expiresAt: new Date(Date.now() - 1) } });
    const exchange = jest.spyOn(service, 'exchangeCodeForToken').mockRejectedValue(new Error('Must not exchange expired state'));
    try {
      const res = await request(app.getHttpServer()).get('/auth/' + provider + '/callback').query({ code: 'expired', state })
        .set('Cookie', oauthStateCookie(config, provider, state)).expect(302);
      expect(res.headers.location).toContain('error=');
      expect(exchange).not.toHaveBeenCalled();
      expect((res.headers['set-cookie'] as unknown as string[]).every(c => c.includes('Max-Age=0'))).toBe(true);
      expect(await app.get(DatabaseService).client.oAuthState.findUnique({ where: { state } })).toBeNull();
    } finally { exchange.mockRestore(); }
  });
});
