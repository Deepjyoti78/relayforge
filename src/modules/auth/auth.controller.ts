import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { parseCookies, serializeCookie } from '../../common/cookies';
import type { User } from '../../generated/prisma/client';
import { RuntimeConfig } from '../config/config.module';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { GitHubOAuthService } from './github-oauth.service';
import { SessionService } from './session.service';

@Controller()
export class AuthController {
  constructor(
    private readonly gitHubOAuth: GitHubOAuthService,
    private readonly sessionService: SessionService,
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly config: RuntimeConfig,
  ) {}

  @Get('auth/github/start')
  async githubStart(@Query('redirect_uri') redirectUri: string | undefined, @Res() res: Response): Promise<void> {
    const { url } = await this.gitHubOAuth.createAuthorizationUrl(redirectUri);
    res.redirect(302, url);
  }

  @Get('auth/github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const { user, redirectUri } = await this.gitHubOAuth.handleCallback(code, state);
    const { token, session } = await this.sessionService.createSession(user.id);

    // Calculate maxAge in seconds
    const maxAge = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    const cookieHeader = serializeCookie(this.config.values.sessionCookieName, token, {
      httpOnly: true,
      secure: this.config.values.environment === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge,
      expires: session.expiresAt,
    });

    res.setHeader('Set-Cookie', cookieHeader);

    // Pass token in redirect URL to support seamless multi-origin local dev (localhost <-> 127.0.0.1)
    let destination = redirectUri;
    try {
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('token', token);
      destination = redirectUrl.toString();
    } catch {
      destination = redirectUri;
    }

    res.redirect(302, destination);
  }

  @Post('v1/auth/logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async logout(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[this.config.values.sessionCookieName] || req.sessionToken;

    if (token) {
      await this.sessionService.revokeSession(token);
    }

    const clearCookie = serializeCookie(this.config.values.sessionCookieName, '', {
      httpOnly: true,
      secure: this.config.values.environment === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    res.setHeader('Set-Cookie', clearCookie);
    res.json({ success: true });
  }

  @Get('v1/me')
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
