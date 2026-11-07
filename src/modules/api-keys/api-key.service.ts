import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { generateApiKey, hashToken } from '../../common/crypto';
import { AuthorizationService } from '../auth/authorization.service';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';

export interface CreateApiKeyInput {
  name: string;
  scopes?: string[];
  expiresAt?: Date | string;
}

export interface ApiKeyMetadata {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdBy: string | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ValidatedApiKey {
  id: string;
  organizationId: string;
  name: string;
  scopes: string[];
}

interface RawVerifyResult {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string | null;
  expires_at: Date | null;
  revoked_at: Date | null;
}

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * Generates a new API key for the organization.
   * Runs inside tenant context. Only OWNER and DEVELOPER roles can generate API keys.
   * The raw plaintext key is returned ONLY in this response and is never stored.
   */
  async createApiKey(
    orgId: string,
    userId: string,
    input: CreateApiKeyInput,
  ): Promise<{ apiKey: string; record: ApiKeyMetadata }> {
    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length === 0) {
      throw new BadRequestException('API key name is required');
    }

    const { rawKey, keyPrefix, keyHash } = generateApiKey('rf_live_');
    const scopes = input.scopes && input.scopes.length > 0 ? input.scopes : ['ingest'];
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const apiKeyId = randomUUID();

    const record = await this.tenantContext.runInTenantContext(orgId, userId, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } },
      });

      if (!currentMember) {
        throw new NotFoundException('Organization not found');
      }

      this.authz.assertRole(currentMember.role, 'DEVELOPER');

      const created = await tx.apiKey.create({
        data: {
          id: apiKeyId,
          organizationId: orgId,
          name: trimmedName,
          keyPrefix,
          keyHash,
          scopes,
          createdBy: userId,
          expiresAt,
        },
      });

      return {
        id: created.id,
        organizationId: created.organizationId,
        name: created.name,
        keyPrefix: created.keyPrefix,
        scopes: created.scopes,
        createdBy: created.createdBy,
        lastUsedAt: created.lastUsedAt,
        expiresAt: created.expiresAt,
        revokedAt: created.revokedAt,
        createdAt: created.createdAt,
      };
    });

    return { apiKey: rawKey, record };
  }

  /**
   * Lists all API keys for an organization.
   * Runs in tenant context. All organization members (OWNER, DEVELOPER, VIEWER) can view the list.
   */
  async listApiKeys(orgId: string, userId: string): Promise<ApiKeyMetadata[]> {
    return this.tenantContext.runInTenantContext(orgId, userId, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } },
      });

      if (!currentMember) {
        throw new NotFoundException('Organization not found');
      }

      const keys = await tx.apiKey.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });

      return keys.map((k) => ({
        id: k.id,
        organizationId: k.organizationId,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        createdBy: k.createdBy,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        revokedAt: k.revokedAt,
        createdAt: k.createdAt,
      }));
    });
  }

  /**
   * Revokes an API key.
   * Runs in tenant context. Only OWNER and DEVELOPER roles can revoke keys.
   */
  async revokeApiKey(orgId: string, userId: string, keyId: string): Promise<ApiKeyMetadata> {
    return this.tenantContext.runInTenantContext(orgId, userId, async (tx) => {
      const currentMember = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } },
      });

      if (!currentMember) {
        throw new NotFoundException('Organization not found');
      }

      this.authz.assertRole(currentMember.role, 'DEVELOPER');

      const existing = await tx.apiKey.findUnique({
        where: { id: keyId },
      });

      if (!existing || existing.organizationId !== orgId) {
        throw new NotFoundException('API key not found');
      }

      const updated = await tx.apiKey.update({
        where: { id: keyId },
        data: { revokedAt: new Date() },
      });

      return {
        id: updated.id,
        organizationId: updated.organizationId,
        name: updated.name,
        keyPrefix: updated.keyPrefix,
        scopes: updated.scopes,
        createdBy: updated.createdBy,
        lastUsedAt: updated.lastUsedAt,
        expiresAt: updated.expiresAt,
        revokedAt: updated.revokedAt,
        createdAt: updated.createdAt,
      };
    });
  }

  /**
   * Authenticates an incoming API key by calculating its SHA-256 hash and calling the
   * trusted PostgreSQL verify_api_key() security definer function.
   */
  async validateApiKey(rawKey: string): Promise<ValidatedApiKey | null> {
    if (!rawKey || !rawKey.startsWith('rf_live_')) {
      return null;
    }

    const keyHash = hashToken(rawKey);

    const rows = await this.database.client.$queryRaw<RawVerifyResult[]>`
      SELECT * FROM verify_api_key(${keyHash})
    `;

    if (!rows || rows.length === 0) {
      return null;
    }

    const matched = rows[0]!;

    // Touch lastUsedAt asynchronously without blocking request
    void this.database.client.$executeRaw`
      UPDATE api_keys SET last_used_at = clock_timestamp() WHERE id = ${matched.id}::uuid
    `.catch(() => {});

    return {
      id: matched.id,
      organizationId: matched.org_id,
      name: matched.name,
      scopes: matched.scopes,
    };
  }
}
