import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { generateApiKey, hashToken } from '../src/common/crypto';
import { ApiKeyService } from '../src/modules/api-keys/api-key.service';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import type { DatabaseService } from '../src/modules/database/database.service';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';

describe('ApiKeyService & Cryptography', () => {
  it('generates API keys with rf_live_ prefix and consistent SHA-256 hash', () => {
    const { rawKey, keyPrefix, keyHash } = generateApiKey();

    expect(rawKey.startsWith('rf_live_')).toBe(true);
    expect(keyPrefix.startsWith('rf_live_')).toBe(true);
    expect(keyPrefix.length).toBeLessThan(rawKey.length);
    expect(keyHash).toBe(hashToken(rawKey));
    expect(keyHash).toHaveLength(64); // SHA-256 hex string
  });

  it('rejects empty or whitespace-only API key names', async () => {
    const mockDb = {} as unknown as DatabaseService;
    const mockTenantContext = {} as unknown as TenantContextService;
    const authz = new AuthorizationService();
    const service = new ApiKeyService(mockDb, mockTenantContext, authz);

    await expect(
      service.createApiKey('org-1', 'user-1', { name: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks VIEWER role from creating API keys', async () => {
    const mockDb = {} as unknown as DatabaseService;
    const mockTenantContext = {
      runInTenantContext: jest.fn().mockImplementation((_orgId: string, _userId: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          membership: {
            findUnique: jest.fn().mockResolvedValue({ role: 'VIEWER' }),
          },
        };
        return fn(tx);
      }),
    } as unknown as TenantContextService;
    const authz = new AuthorizationService();
    const service = new ApiKeyService(mockDb, mockTenantContext, authz);

    await expect(
      service.createApiKey('org-1', 'user-viewer', { name: 'Test Key' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows DEVELOPER role to create API keys', async () => {
    const mockDb = {} as unknown as DatabaseService;
    const mockTenantContext = {
      runInTenantContext: jest.fn().mockImplementation((_orgId: string, _userId: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          membership: {
            findUnique: jest.fn().mockResolvedValue({ role: 'DEVELOPER' }),
          },
          apiKey: {
            create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
              ...data,
              createdAt: new Date(),
              lastUsedAt: null,
              revokedAt: null,
            })),
          },
        };
        return fn(tx);
      }),
    } as unknown as TenantContextService;
    const authz = new AuthorizationService();
    const service = new ApiKeyService(mockDb, mockTenantContext, authz);

    const result = await service.createApiKey('org-1', 'user-dev', { name: 'Dev Key' });
    expect(result.apiKey.startsWith('rf_live_')).toBe(true);
    expect(result.record.name).toBe('Dev Key');
    expect(result.record.scopes).toEqual(['ingest']);
  });

  it('returns null when validating an invalid or empty raw key', async () => {
    const mockDb = { client: { $queryRaw: jest.fn() } } as unknown as DatabaseService;
    const mockTenantContext = {} as unknown as TenantContextService;
    const authz = new AuthorizationService();
    const service = new ApiKeyService(mockDb, mockTenantContext, authz);

    expect(await service.validateApiKey('')).toBeNull();
    expect(await service.validateApiKey('invalid_prefix_123')).toBeNull();
  });
});
