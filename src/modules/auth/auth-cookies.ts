import { BadRequestException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { parseCookies, serializeCookie } from '../../common/cookies';
import type { CookieOptions } from '../../common/cookies';
import { hashToken } from '../../common/crypto';
import type { Environment } from '../config/environment';

type CookieConfig = Pick<Environment, 'environment' | 'sessionCookieName'> & { sessionCookieSameSite?: 'Lax' | 'None' };
export type OAuthProvider = 'google' | 'github';

export function sessionCookieOptions(config: CookieConfig): CookieOptions {
  return { httpOnly: true, secure: config.environment === 'production',
    sameSite: config.sessionCookieSameSite ?? (config.environment === 'production' ? 'None' : 'Lax'), path: '/' };
}

export function clearSessionCookie(config: CookieConfig): string {
  return serializeCookie(config.sessionCookieName, '', { ...sessionCookieOptions(config), maxAge: 0, expires: new Date(0) });
}

function stateCookieName(config: CookieConfig, provider: OAuthProvider): string {
  return (config.environment === 'production' && !config.sessionCookieName.startsWith('__Host-') ? '__Host-' : '') + config.sessionCookieName + '_oauth_' + provider;
}

export function oauthStateCookie(config: CookieConfig, provider: OAuthProvider, state: string | null): string {
  return serializeCookie(stateCookieName(config, provider), state === null ? '' : hashToken(state), {
    httpOnly: true, secure: config.environment === 'production', sameSite: 'Lax', path: '/',
    maxAge: state === null ? 0 : 600, ...(state === null ? { expires: new Date(0) } : {}),
  });
}

export function verifyOAuthBrowserState(config: CookieConfig, provider: OAuthProvider, state: unknown, cookieHeader: string | undefined): void {
  const expected = parseCookies(cookieHeader)[stateCookieName(config, provider)];
  if (typeof state !== 'string' || !state || state.length > 256 || !expected || !/^[a-f0-9]{64}$/.test(expected)
    || !timingSafeEqual(Buffer.from(hashToken(state), 'hex'), Buffer.from(expected, 'hex'))) {
    throw new BadRequestException('Invalid browser-bound OAuth state');
  }
}
