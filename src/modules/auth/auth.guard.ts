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
import { isTrustedFrontendOrigin, isTrustedFrontendUrl } from './browser-security';
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
    const token = cookies[cookieName] || this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const auth = await this.sessionService.validateSession(token);
    if (!auth) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // CSRF defense-in-depth on state-changing requests
    if (cookies[cookieName]) this.verifyCsrfProtection(request);

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
    const frontend = this.config.values.frontendUrl;
    if (origin) {
      if (!isTrustedFrontendOrigin(origin, frontend)) {
        throw new ForbiddenException('CSRF origin mismatch');
      }
      return;
    }
    // Older browsers may omit Origin; require a trusted Referer in that case.
    const referer = request.headers.referer;
    if (!referer || !isTrustedFrontendUrl(referer, frontend)) {
      throw new ForbiddenException('CSRF origin required');
    }
  }
}
