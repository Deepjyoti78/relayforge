import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import type { RuntimeConfig } from '../src/modules/config/config.module';
import type { SessionService } from '../src/modules/auth/session.service';

const config = { values: {
  frontendUrl: 'https://app.example.com',
  githubCallbackUrl: 'https://api.example.com/auth/github/callback',
  googleCallbackUrl: 'https://api.example.com/auth/google/callback',
  sessionCookieName: 'rf_session', environment: 'production',
} } as RuntimeConfig;

function guardRequest(headers: Record<string, string>, method = 'POST') {
  const service = { validateSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, session: {} }) };
  const guard = new AuthGuard(service as unknown as SessionService, config);
  const req = { headers: { host: 'api.example.com', ...headers }, method };
  const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return guard.canActivate(context);
}

describe('Cookie session CSRF protection', () => {
  it.each([
    'https://attacker.onrender.com', 'https://attacker.workers.dev',
    'https://attacker.pages.dev', 'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://api.example.com', 'null', 'https://app.example.com/path',
  ])('rejects cookie mutations from %s', async (origin) => {
    await expect(guardRequest({ cookie: 'rf_session=session', origin })).rejects.toThrow(ForbiddenException);
  });
  it('rejects cookie mutations without Origin or Referer', async () => {
    await expect(guardRequest({ cookie: 'rf_session=session' })).rejects.toThrow(ForbiddenException);
  });
  it('rejects cross-site cookie mutations without Origin', async () => {
    await expect(guardRequest({ cookie: 'rf_session=session', 'sec-fetch-site': 'cross-site' })).rejects.toThrow(ForbiddenException);
  });
  it('accepts the exact frontend origin', async () => {
    await expect(guardRequest({ cookie: 'rf_session=session', origin: 'https://app.example.com' })).resolves.toBe(true);
  });
  it('accepts an exact trusted Referer when Origin is absent', async () => {
    await expect(guardRequest({ cookie: 'rf_session=session', referer: 'https://app.example.com/settings' })).resolves.toBe(true);
  });
  it('supports explicit bearer clients without Origin', async () => {
    await expect(guardRequest({ authorization: 'Bearer session' })).resolves.toBe(true);
  });
  it('does not let a bearer header bypass CSRF when a cookie supplies authentication', async () => {
    await expect(guardRequest({ cookie: 'rf_session=session', authorization: 'Bearer other' })).rejects.toThrow(ForbiddenException);
  });
  it('allows safe cookie reads', async () => {
    await expect(guardRequest({ cookie: 'rf_session=session' }, 'GET')).resolves.toBe(true);
  });
});
