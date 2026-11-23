import { SessionService } from '../src/modules/auth/session.service';
import type { DatabaseService } from '../src/modules/database/database.service';
import { clearSessionCookie, oauthStateCookie, sessionCookieOptions, verifyOAuthBrowserState } from '../src/modules/auth/auth-cookies';
import { hashToken } from '../src/common/crypto';

describe('Session lifecycle and cookie policy', () => {
  it('stores only a token hash and gives sessions a fixed seven-day expiry', async () => {
    const create = jest.fn<Promise<unknown>, [{ data: { tokenHash: string; expiresAt: Date; userId: string } }]>().mockResolvedValue({});
    const service = new SessionService({ client: { session: { create } } } as unknown as DatabaseService);
    const now = Date.now();
    const created = await service.createSession('user-1');
    const args = create.mock.calls[0]?.[0] as { data: { tokenHash: string; expiresAt: Date; userId: string } };
    expect(args.data.tokenHash).toBe(hashToken(created.token));
    expect(JSON.stringify(args)).not.toContain(created.token);
    expect(args.data.expiresAt.getTime()).toBeGreaterThanOrEqual(now + 7 * 86400000);
  });
  it.each(['expired', 'revoked', 'missing'])('rejects %s sessions', async (reason) => {
    const record = { expiresAt: new Date(Date.now() + 60000), revokedAt: null as Date | null, lastActiveAt: new Date(), user: { id: 'user-1' } };
    if (reason === 'expired') record.expiresAt = new Date(Date.now() - 1);
    if (reason === 'revoked') record.revokedAt = new Date();
    const update = jest.fn();
    const service = new SessionService({ client: { session: {
      findUnique: jest.fn().mockResolvedValue(reason === 'missing' ? null : record), update,
    } } } as unknown as DatabaseService);
    expect(await service.validateSession('a'.repeat(64))).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
  it('updates last activity without refreshing the token or extending absolute expiry', async () => {
    const expiresAt = new Date(Date.now() + 60000);
    const record = { id: 'session-1', expiresAt, revokedAt: null, lastActiveAt: new Date(Date.now() - 61000), user: { id: 'user-1' } };
    const update = jest.fn().mockResolvedValue({});
    const service = new SessionService({ client: { session: { findUnique: jest.fn().mockResolvedValue(record), update } } } as unknown as DatabaseService);
    const auth = await service.validateSession('a'.repeat(64));
    expect(auth?.session.expiresAt).toBe(expiresAt);
    expect(update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { lastActiveAt: expect.any(Date) as unknown } });
  });
  it.each(['Lax', 'None'] as const)('uses matching production %s flags for session creation and clearing', (sameSite) => {
    const config = { environment: 'production' as const, sessionCookieName: 'rf_session', sessionCookieSameSite: sameSite };
    const options = sessionCookieOptions(config);
    expect(options).toEqual({ httpOnly: true, secure: true, sameSite, path: '/' });
    const cleared = clearSessionCookie(config);
    expect(cleared).toContain('HttpOnly'); expect(cleared).toContain('Secure');
    expect(cleared).toContain('SameSite=' + sameSite); expect(cleared).toContain('Max-Age=0');
    expect(cleared).not.toContain('Domain=');
    const binding = oauthStateCookie(config, 'google', 'state');
    expect(binding).toContain('__Host-rf_session_oauth_google='); expect(binding).toContain('SameSite=Lax');
    expect(binding).not.toContain('=state');
    expect(() => verifyOAuthBrowserState(config, 'google', 'state', binding)).not.toThrow();
    expect(() => verifyOAuthBrowserState(config, 'github', 'state', binding)).toThrow();
    expect(() => verifyOAuthBrowserState(config, 'google', ['state'], binding)).toThrow();
  });
});
