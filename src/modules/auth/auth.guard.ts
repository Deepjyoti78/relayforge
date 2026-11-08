import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseCookies } from '../../common/cookies';
import type { Session, User } from '../../generated/prisma/client';
import { RuntimeConfig } from '../config/config.module';
import { SessionService } from './session.service';

export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: Session;
  sessionToken?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly config: RuntimeConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Parse session cookie
    const cookies = parseCookies(request.headers.cookie);
    const cookieName = this.config.values.sessionCookieName;
    const isProd = this.config.values.environment === 'production';
    const token = cookies[cookieName] || (!isProd ? this.extractBearerToken(request) : undefined);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const auth = await this.sessionService.validateSession(token);
    if (!auth) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // CSRF defense-in-depth on state-changing requests
    this.verifyCsrfProtection(request);

    request.user = auth.user;
    request.session = auth.session;
    request.sessionToken = token;

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return undefined;
  }

  private verifyCsrfProtection(request: Request): void {
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(request.method)) return;

    const origin = request.headers.origin;
    if (!origin) {
      // If no origin header, check sec-fetch-site or standard header
      const secFetchSite = request.headers['sec-fetch-site'];
      if (secFetchSite && secFetchSite === 'cross-site') {
        throw new ForbiddenException('Cross-site requests forbidden');
      }
      return;
    }

    try {
      const originUrl = new URL(origin);
      const host = request.headers.host;
      const frontendUrl = new URL(this.config.values.frontendUrl);

      // Allow matching host or matching configured frontend origin
      const isAllowed = originUrl.host === host
        || originUrl.origin === frontendUrl.origin
        || originUrl.hostname === '127.0.0.1'
        || originUrl.hostname === 'localhost';

      if (!isAllowed) {
        throw new ForbiddenException('CSRF origin mismatch');
      }
    } catch {
      throw new ForbiddenException('Invalid request origin');
    }
  }
}
