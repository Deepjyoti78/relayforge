import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import type { RuntimeConfig } from '../src/modules/config/config.module';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';
import { DestinationService } from '../src/modules/destinations/destination.service';

describe('Milestone 3 Option 1: Destination Registry Unit Tests', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const destId = '33333333-3333-3333-3333-333333333333';

  let destinationService: DestinationService;
  let mockTenantContext: jest.Mocked<TenantContextService>;
  let mockAuthz: AuthorizationService;
  let mockConfig: RuntimeConfig;

  const sampleRecord = {
    id: destId,
    organizationId: orgId,
    name: 'Production Webhook Target',
    url: 'https://httpbin.org/post',
    httpMethod: 'POST',
    headers: { 'X-Custom-Header': 'SecretValue' },
    rateLimitPerSecond: 100,
    timeoutMs: 5000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockTenantContext = {
      runInTenantContext: jest
        .fn()
        .mockImplementation(
          <T>(_orgId: string, _userId: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
            const mockTx = {
              membership: {
                findUnique: jest.fn().mockResolvedValue({ role: 'DEVELOPER' }),
              },
              destination: {
                create: jest.fn().mockResolvedValue(sampleRecord),
                findMany: jest.fn().mockResolvedValue([sampleRecord]),
                findFirst: jest.fn().mockResolvedValue(sampleRecord),
                update: jest.fn().mockResolvedValue({ ...sampleRecord, name: 'Updated Target' }),
                delete: jest.fn().mockResolvedValue(sampleRecord),
              },
            };
            return fn(mockTx);
          },
        ),
    } as unknown as jest.Mocked<TenantContextService>;

    mockAuthz = new AuthorizationService();
    mockConfig = {
      values: {
        allowPrivateDestinations: true, // Allow for test harness
      },
    } as unknown as RuntimeConfig;

    destinationService = new DestinationService(mockTenantContext, mockAuthz, mockConfig);
  });

  describe('createDestination', () => {
    it('creates destination successfully with valid parameters', async () => {
      const result = await destinationService.createDestination(orgId, userId, {
        name: 'Production Webhook Target',
        url: 'https://httpbin.org/post',
        httpMethod: 'POST',
        headers: { 'X-Custom-Header': 'SecretValue' },
        rateLimitPerSecond: 100,
        timeoutMs: 5000,
      });

      expect(result.id).toBe(destId);
      expect(result.name).toBe('Production Webhook Target');
      expect(result.rateLimitPerSecond).toBe(100);
      expect(result.timeoutMs).toBe(5000);
    });

    it('rejects destination names that are too short or empty', async () => {
      await expect(
        destinationService.createDestination(orgId, userId, {
          name: ' ',
          url: 'https://httpbin.org/post',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unsupported HTTP methods', async () => {
      await expect(
        destinationService.createDestination(orgId, userId, {
          name: 'Target',
          url: 'https://httpbin.org/post',
          httpMethod: 'DELETE',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid rate limits (out of bounds)', async () => {
      await expect(
        destinationService.createDestination(orgId, userId, {
          name: 'Target',
          url: 'https://httpbin.org/post',
          rateLimitPerSecond: 0,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        destinationService.createDestination(orgId, userId, {
          name: 'Target',
          url: 'https://httpbin.org/post',
          rateLimitPerSecond: 10000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-string headers', async () => {
      await expect(
        destinationService.createDestination(orgId, userId, {
          name: 'Target',
          url: 'https://httpbin.org/post',
          headers: { key: 123 as unknown as string },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces DEVELOPER role check when creating', async () => {
      mockTenantContext.runInTenantContext = jest
        .fn()
        .mockImplementation(
          <T>(_orgId: string, _userId: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
            const mockTx = {
              membership: {
                findUnique: jest.fn().mockResolvedValue({ role: 'VIEWER' }),
              },
            };
            return fn(mockTx);
          },
        );

      await expect(
        destinationService.createDestination(orgId, userId, {
          name: 'Target',
          url: 'https://httpbin.org/post',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listDestinations & getDestination', () => {
    it('returns list of destinations for organization', async () => {
      const list = await destinationService.listDestinations(orgId, userId);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(destId);
    });

    it('retrieves single destination by ID', async () => {
      const dest = await destinationService.getDestination(orgId, userId, destId);
      expect(dest.id).toBe(destId);
      expect(dest.url).toBe('https://httpbin.org/post');
    });

    it('throws NotFoundException when destination not found', async () => {
      mockTenantContext.runInTenantContext = jest
        .fn()
        .mockImplementation(
          <T>(_orgId: string, _userId: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
            const mockTx = {
              membership: {
                findUnique: jest.fn().mockResolvedValue({ role: 'DEVELOPER' }),
              },
              destination: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            };
            return fn(mockTx);
          },
        );

      await expect(destinationService.getDestination(orgId, userId, 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateDestination & deleteDestination', () => {
    it('updates destination fields successfully', async () => {
      const updated = await destinationService.updateDestination(orgId, userId, destId, {
        name: 'Updated Target',
      });
      expect(updated.name).toBe('Updated Target');
    });

    it('deletes destination successfully', async () => {
      const res = await destinationService.deleteDestination(orgId, userId, destId);
      expect(res.success).toBe(true);
      expect(res.id).toBe(destId);
    });
  });
});
