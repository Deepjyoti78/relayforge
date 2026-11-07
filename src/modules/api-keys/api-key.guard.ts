import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyService, ValidatedApiKey } from './api-key.service';

export interface AuthenticatedApiKeyRequest extends Request {
  apiKey?: ValidatedApiKey;
  orgId?: string;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedApiKeyRequest>();

    const rawKey = this.extractApiKey(request);
    if (!rawKey) {
      throw new UnauthorizedException('Missing API key (provide via x-api-key header or Bearer token)');
    }

    const validated = await this.apiKeyService.validateApiKey(rawKey);
    if (!validated) {
      throw new UnauthorizedException('Invalid, expired, or revoked API key');
    }

    request.apiKey = validated;
    request.orgId = validated.organizationId;

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // 1. Check x-api-key header
    const headerKey = request.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim().length > 0) {
      return headerKey.trim();
    }

    // 2. Check Authorization: Bearer rf_live_...
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token.startsWith('rf_live_')) {
        return token;
      }
    }

    return undefined;
  }
}
