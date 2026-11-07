import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  computeHmacSignature,
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  verifyWebhookSignature,
} from '../src/common/crypto';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import type { RuntimeConfig } from '../src/modules/config/config.module';
import type { DatabaseService } from '../src/modules/database/database.service';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';
import { EndpointService } from '../src/modules/endpoints/endpoint.service';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';

describe('Milestone 3 Phase 2 & 3: Cryptography & Service Unit Tests', () => {
  const masterKey = randomBytes(32);

  describe('Webhook Signing Secret Generation & AES-256-GCM Envelope Encryption', () => {
    it('generates secrets with whsec_ prefix and preview', () => {
      const { rawSecret, secretPreview } = generateWebhookSecret();
      expect(rawSecret.startsWith('whsec_')).toBe(true);
      expect(secretPreview.startsWith('whsec_')).toBe(true);
      expect(secretPreview.length).toBe(10);
      expect(rawSecret.length).toBeGreaterThan(20);
    });

    it('encrypts and decrypts secret cleanly with AES-256-GCM', () => {
      const { rawSecret } = generateWebhookSecret();
      const { ciphertext, iv, tag } = encryptSecret(rawSecret, masterKey);

      expect(ciphertext).toBeDefined();
      expect(iv).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(tag).toHaveLength(32); // 16 bytes = 32 hex chars

      const decrypted = decryptSecret(ciphertext, iv, tag, masterKey);
      expect(decrypted).toBe(rawSecret);
    });

    it('fails decryption if ciphertext, tag, or key is tampered with', () => {
      const { rawSecret } = generateWebhookSecret();
      const { ciphertext, iv, tag } = encryptSecret(rawSecret, masterKey);

      // Tampered tag
      const tamperedTag = '00' + tag.slice(2);
      expect(() => decryptSecret(ciphertext, iv, tamperedTag, masterKey)).toThrow();

      // Wrong key
      const wrongKey = randomBytes(32);
      expect(() => decryptSecret(ciphertext, iv, tag, wrongKey)).toThrow();
    });
  });

  describe('HMAC-SHA256 Signature Computation & Verification', () => {
    const secret = 'whsec_test_secret_12345';
    const payload = JSON.stringify({ event: 'order.completed', amount: 9900 });

    it('computes correct HMAC signature and verifies raw / sha256= headers', () => {
      const hmac = computeHmacSignature(payload, secret);
      expect(hmac).toHaveLength(64);

      // Raw hex header
      expect(verifyWebhookSignature(payload, hmac, secret)).toBe(true);

      // sha256= prefixed header
      expect(verifyWebhookSignature(payload, `sha256=${hmac}`, secret)).toBe(true);

      // Invalid signature rejected
      expect(verifyWebhookSignature(payload, 'wrong_hex_signature', secret)).toBe(false);
    });

    it('verifies timestamped signatures (t=...,v1=...) within tolerance', () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = computeHmacSignature(`${now}.${payload}`, secret);
      const header = `t=${now},v1=${signature}`;

      expect(verifyWebhookSignature(payload, header, secret)).toBe(true);
    });

    it('rejects timestamped signatures that exceed tolerance window', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const signature = computeHmacSignature(`${expiredTimestamp}.${payload}`, secret);
      const header = `t=${expiredTimestamp},v1=${signature}`;

      // Default tolerance is 300 seconds (5 min)
      expect(verifyWebhookSignature(payload, header, secret)).toBe(false);
    });

    it('rejects tampered payload under valid signature header', () => {
      const hmac = computeHmacSignature(payload, secret);
      const tamperedPayload = JSON.stringify({ event: 'order.completed', amount: 1 });

      expect(verifyWebhookSignature(tamperedPayload, hmac, secret)).toBe(false);
    });
  });

  describe('EndpointService Authorization Boundaries', () => {
    it('blocks VIEWER role from creating an endpoint', async () => {
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
      const mockConfig = { values: { encryptionKey: masterKey } } as unknown as RuntimeConfig;

      const service = new EndpointService(mockDb, mockTenantContext, authz, mockConfig);

      await expect(
        service.createEndpoint('org-1', 'user-viewer', { name: 'Payments Ingest' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects invalid or empty endpoint names', async () => {
      const mockDb = {} as unknown as DatabaseService;
      const mockTenantContext = {} as unknown as TenantContextService;
      const authz = new AuthorizationService();
      const mockConfig = { values: { encryptionKey: masterKey } } as unknown as RuntimeConfig;

      const service = new EndpointService(mockDb, mockTenantContext, authz, mockConfig);

      await expect(
        service.createEndpoint('org-1', 'user-1', { name: ' ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('IngestionService Signature & Deduplication', () => {
    it('throws NotFoundException when endpoint is not found or inactive', async () => {
      const mockDb = {} as unknown as DatabaseService;
      const mockEndpointService = {
        getEndpointForIngestion: jest.fn().mockResolvedValue(null),
      } as unknown as EndpointService;

      const service = new IngestionService(mockDb, mockEndpointService);

      await expect(
        service.ingestWebhook('non-existent-endpoint', Buffer.from('{}'), {}, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects webhooks with invalid signatures', async () => {
      const mockDb = {} as unknown as DatabaseService;
      const mockEndpointService = {
        getEndpointForIngestion: jest.fn().mockResolvedValue({
          id: 'ep-1',
          organizationId: 'org-1',
          name: 'Stripe Ingestion',
          signingSecret: 'whsec_real_secret',
        }),
      } as unknown as EndpointService;

      const service = new IngestionService(mockDb, mockEndpointService);

      await expect(
        service.ingestWebhook(
          'ep-1',
          Buffer.from('{"data": 1}'),
          { 'x-relayforge-signature': 'invalid_signature_hex' },
          { data: 1 },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
