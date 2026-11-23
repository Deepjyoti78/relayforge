import {
  Controller,
  Get,
  HttpCode,
  Header,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseCookies, serializeCookie } from '../../common/cookies';
import type { User } from '../../generated/prisma/client';
import { RuntimeConfig } from '../config/config.module';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';
import { clearSessionCookie, oauthStateCookie, sessionCookieOptions, verifyOAuthBrowserState } from './auth-cookies';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { GitHubOAuthService } from './github-oauth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { SessionService } from './session.service';

@Controller()
export class AuthController {
  constructor(
    private readonly gitHubOAuth: GitHubOAuthService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly sessionService: SessionService,
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly config: RuntimeConfig,
  ) {}

  @Get('auth/github/start')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async githubStart(@Query('redirect_uri') redirectUri: string | undefined, @Res() res: Response): Promise<void> {
    const { url, state } = await this.gitHubOAuth.createAuthorizationUrl(redirectUri);
    res.setHeader('Set-Cookie', oauthStateCookie(this.config.values, 'github', state));
    res.redirect(302, url);
  }

  @Get('auth/github/callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Req() req: Request,
    @Query('error') error?: string,
  ): Promise<void> {
    try {
      verifyOAuthBrowserState(this.config.values, 'github', state, req.headers.cookie);
      res.setHeader('Set-Cookie', oauthStateCookie(this.config.values, 'github', null));
      if (error) {
        await this.database.client.oAuthState.deleteMany({ where: { state } });
        throw new Error('Provider authorization denied');
      }

      const { user, redirectUri } = await this.gitHubOAuth.handleCallback(code, state);
      const { token, session } = await this.sessionService.createSession(user.id);

      // Calculate maxAge in seconds
      const maxAge = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
      const cookieHeader = serializeCookie(this.config.values.sessionCookieName, token, {
        ...sessionCookieOptions(this.config.values),
        maxAge,
        expires: session.expiresAt,
      });

      res.append('Set-Cookie', cookieHeader);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.redirect(302, redirectUri);
    } catch {
      let dest = this.config.values.frontendUrl;
      try {
        const fallbackUrl = new URL(dest);
        fallbackUrl.searchParams.set('error', 'github_auth_failed');
        dest = fallbackUrl.toString();
      } catch {}
      res.redirect(302, dest);
    }
  }

  @Get('auth/google/start')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async googleStart(@Query('redirect_uri') redirectUri: string | undefined, @Res() res: Response): Promise<void> {
    const { url, state } = await this.googleOAuth.createAuthorizationUrl(redirectUri);
    res.setHeader('Set-Cookie', oauthStateCookie(this.config.values, 'google', state));
    res.redirect(302, url);
  }

  @Get('auth/google/callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Req() req: Request,
    @Query('error') error?: string,
  ): Promise<void> {
    try {
      verifyOAuthBrowserState(this.config.values, 'google', state, req.headers.cookie);
      res.setHeader('Set-Cookie', oauthStateCookie(this.config.values, 'google', null));
      if (error) {
        await this.database.client.oAuthState.deleteMany({ where: { state } });
        throw new Error('Provider authorization denied');
      }

      const { user, redirectUri } = await this.googleOAuth.handleCallback(code, state);
      const { token, session } = await this.sessionService.createSession(user.id);

      // Calculate maxAge in seconds
      const maxAge = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
      const cookieHeader = serializeCookie(this.config.values.sessionCookieName, token, {
        ...sessionCookieOptions(this.config.values),
        maxAge,
        expires: session.expiresAt,
      });

      res.append('Set-Cookie', cookieHeader);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.redirect(302, redirectUri);
    } catch {
      let dest = this.config.values.frontendUrl;
      try {
        const fallbackUrl = new URL(dest);
        fallbackUrl.searchParams.set('error', 'google_auth_failed');
        dest = fallbackUrl.toString();
      } catch {}
      res.redirect(302, dest);
    }
  }

  @Post('v1/auth/logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async logout(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[this.config.values.sessionCookieName] || req.sessionToken;

    if (token) {
      await this.sessionService.revokeSession(token);
    }

    res.setHeader('Set-Cookie', clearSessionCookie(this.config.values));
    res.json({ success: true });
  }

  @Get('v1/me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: User) {
    // Retrieve memberships for this user within user context so RLS permits access
    const memberships = await this.tenantContext.runInUserContext(user.id, async (tx) => {
      return tx.membership.findMany({
        where: { userId: user.id },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    };
  }
}
