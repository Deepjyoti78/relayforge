import { BadRequestException } from '@nestjs/common';
import {
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../src/common/crypto';
import {
  isReservedDeliveryHeader,
  redactSensitiveHeaders,
} from '../src/common/header-utils';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import type { RuntimeConfig } from '../src/modules/config/config.module';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';
import { DeliveryService } from '../src/modules/delivery/delivery.service';
import { DestinationService } from '../src/modules/destinations/destination.service';

describe('Phase 1: Webhook Security Hardening Regression Tests', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const destId = '33333333-3333-3333-3333-333333333333';
  const eventId = '44444444-4444-4444-4444-444444444444';

  const testEncryptionKey = Buffer.from(
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    'hex',
  );

  let mockConfig: RuntimeConfig;
  let mockAuthz: AuthorizationService;
  let mockTenantContext: jest.Mocked<TenantContextService>;
  let destinationService: DestinationService;
  let deliveryService: DeliveryService;

  beforeEach(() => {
    mockAuthz = new AuthorizationService();
    mockConfig = {
      values: {
        allowPrivateDestinations: true,
        encryptionKey: testEncryptionKey,
      },
    } as unknown as RuntimeConfig;

    const sampleDestination = {
      id: destId,
      organizationId: orgId,
      name: 'Secure Destination',
      url: 'https://example.com/webhook',
      httpMethod: 'POST',
      headers: {
        Authorization: 'Bearer super-secret-token',
        'X-Api-Key': 'key_live_99999',
        'X-Custom-Header': 'public-value',
      },
      rateLimitPerSecond: 100,
      timeoutMs: 5000,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
                create: jest.fn().mockResolvedValue(sampleDestination),
                findFirst: jest.fn().mockResolvedValue(sampleDestination),
                findMany: jest.fn().mockResolvedValue([sampleDestination]),
                update: jest.fn().mockResolvedValue(sampleDestination),
              },
              deliveryAttempt: {
                create: jest.fn().mockImplementation((args: { data: unknown }) =>
                  Promise.resolve({
                    createdAt: new Date(),
                    ...(args.data as Record<string, unknown>),
                  }),
                ),
              },
            };
            return fn(mockTx);
          },
        ),
    } as unknown as jest.Mocked<TenantContextService>;

    destinationService = new DestinationService(mockTenantContext, mockAuthz, mockConfig);
    deliveryService = new DeliveryService(mockTenantContext, mockAuthz, mockConfig);
  });

  describe('1. Reserved Header Validation & Override Protection', () => {
    const reservedHeadersToTest = [
      'Host',
      'host',
      'HOST',
      'Content-Length',
      'content-length',
      'Content-Type',
      'Transfer-Encoding',
      'Connection',
      'Keep-Alive',
      'Upgrade',
      'Idempotency-Key',
      'User-Agent',
      'X-RelayForge-Signature',
      'x-relayforge-signature',
      'X-RelayForge-Timestamp',
      'X-RelayForge-Delivery',
      'x-relayforge-delivery-id',
      'X-RelayForge-Attempt',
      'Proxy-Authorization',
      'proxy-connection',
    ];

    for (const header of reservedHeadersToTest) {
      it(`rejects reserved header '${header}' on createDestination`, async () => {
        await expect(
          destinationService.createDestination(orgId, userId, {
            name: 'Malicious Header Destination',
            url: 'https://example.com/webhook',
            headers: { [header]: 'malicious-override-value' },
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it(`rejects reserved header '${header}' on updateDestination`, async () => {
        await expect(
          destinationService.updateDestination(orgId, userId, destId, {
            headers: { [header]: 'malicious-override-value' },
          }),
        ).rejects.toThrow(BadRequestException);
      });
    }

    it('identifies reserved headers case-insensitively via isReservedDeliveryHeader', () => {
      expect(isReservedDeliveryHeader('HOST')).toBe(true);
      expect(isReservedDeliveryHeader('content-length')).toBe(true);
      expect(isReservedDeliveryHeader('X-RelayForge-Signature')).toBe(true);
      expect(isReservedDeliveryHeader('x-relayforge-delivery')).toBe(true);
      expect(isReservedDeliveryHeader('proxy-authenticate')).toBe(true);
      // Custom metadata headers should be permitted
      expect(isReservedDeliveryHeader('X-Custom-Header')).toBe(false);
      expect(isReservedDeliveryHeader('X-RelayForge-Org')).toBe(false);
    });

    it('enforces protection at final delivery boundary even if reserved headers were injected', async () => {
      let capturedHeaders: Record<string, string> = {};
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((_url, init?: RequestInit) => {
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
        return Promise.resolve(new Response('OK', { status: 200 }));
      });

      try {
        await deliveryService.deliverEventToDestination({
          organizationId: orgId,
          eventId,
          destination: {
            id: destId,
            url: 'https://example.com/webhook',
            headers: {
              Host: 'evil-host.com',
              'Content-Type': 'text/plain',
              'X-RelayForge-Signature': 'fake-sig',
              'X-RelayForge-Event': 'fake-event',
              'X-Allowed-Custom': 'valid-value',
            },
          },
          payload: { hello: 'world' },
          eventType: 'order.created',
          signingSecret: 'whsec_test_secret_123',
        });

        // RelayForge-owned headers must NOT be overridden
        expect(capturedHeaders['content-type']).toBe('application/json');
        expect(capturedHeaders['x-relayforge-signature']).not.toBe('fake-sig');
        expect(capturedHeaders['x-relayforge-signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
        expect(capturedHeaders['x-relayforge-event']).toBe('order.created');
        expect(capturedHeaders['host']).toBeUndefined();
        // Allowed custom header must still be included
        expect(capturedHeaders['x-allowed-custom']).toBe('valid-value');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('2. Outbound Webhook Signing & Secret Handling', () => {
    it('aborts delivery when signing secret is missing (refuses insecure fallback)', async () => {
      const attempt = await deliveryService.deliverEventToDestination({
        organizationId: orgId,
        eventId,
        destination: {
          id: destId,
          url: 'https://example.com/webhook',
        },
        payload: { test: true },
        eventType: 'test.event',
        // signingSecret deliberately omitted
      });

      expect(attempt.status).toBe('FAILED');
      expect(attempt.statusCode).toBeNull();
      expect(attempt.errorDescription).toContain('no signing secret configured');
    });

    it('encrypts, decrypts, and rotates webhook signing secrets using AES-256-GCM', () => {
      const { rawSecret, secretPreview } = generateWebhookSecret();
      expect(rawSecret).toMatch(/^whsec_[a-zA-Z0-9_-]+/);
      expect(secretPreview).toBe(rawSecret.slice(0, 10));

      const encrypted = encryptSecret(rawSecret, testEncryptionKey);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toHaveLength(24); // 12 bytes hex
      expect(encrypted.tag).toHaveLength(32); // 16 bytes hex

      const decrypted = decryptSecret(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        testEncryptionKey,
      );
      expect(decrypted).toBe(rawSecret);

      // Rotation produces a different secret with valid encryption
      const rotated = generateWebhookSecret();
      expect(rotated.rawSecret).not.toBe(rawSecret);
      const encRotated = encryptSecret(rotated.rawSecret, testEncryptionKey);
      expect(decryptSecret(encRotated.ciphertext, encRotated.iv, encRotated.tag, testEncryptionKey)).toBe(
        rotated.rawSecret,
      );
    });

    it('signs payloads with HMAC-SHA256 and verifies successfully with correct secret', () => {
      const secret = 'whsec_prod_signing_secret_999';
      const body = JSON.stringify({ event: 'invoice.paid', amount: 5000 });
      const now = Math.floor(Date.now() / 1000);

      const signatureHeader = signWebhookPayload(body, secret, now);
      expect(signatureHeader).toContain(`t=${now},v1=`);

      // Verifies with matching secret
      expect(verifyWebhookSignature(body, signatureHeader, secret)).toBe(true);

      // Rejects with wrong secret
      expect(verifyWebhookSignature(body, signatureHeader, 'whsec_wrong_secret')).toBe(false);

      // Rejects with tampered body
      const tamperedBody = JSON.stringify({ event: 'invoice.paid', amount: 999999 });
      expect(verifyWebhookSignature(tamperedBody, signatureHeader, secret)).toBe(false);

      // Rejects expired timestamps
      const staleTimestamp = now - 600; // 10 minutes ago
      const staleHeader = signWebhookPayload(body, secret, staleTimestamp);
      expect(verifyWebhookSignature(body, staleHeader, secret, 300)).toBe(false);
    });
  });

  describe('3. Credential Redaction & Diagnostic Protection', () => {
    it('redacts sensitive headers from DestinationDto returned to API callers', async () => {
      const destination = await destinationService.getDestination(orgId, userId, destId);

      expect(destination.headers).toBeDefined();
      expect(destination.headers!['Authorization']).toBe('[REDACTED]');
      expect(destination.headers!['X-Api-Key']).toBe('[REDACTED]');
      // Non-sensitive custom headers must remain readable
      expect(destination.headers!['X-Custom-Header']).toBe('public-value');
    });

    it('redacts sensitive headers and signing signature before persisting delivery attempt diagnostics', async () => {
      let persistedAttemptData: Record<string, unknown> | undefined;

      mockTenantContext.runInTenantContext = jest
        .fn()
        .mockImplementation(
          <T>(_orgId: string, _userId: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
            const mockTx = {
              deliveryAttempt: {
                create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
                  persistedAttemptData = args.data;
                  return Promise.resolve({
                    createdAt: new Date(),
                    ...args.data,
                  });
                }),
              },
            };
            return fn(mockTx);
          },
        );

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue(new Response('OK', { status: 200 }));

      try {
        await deliveryService.deliverEventToDestination({
          organizationId: orgId,
          eventId,
          destination: {
            id: destId,
            url: 'https://example.com/webhook',
            headers: {
              Authorization: 'Bearer sensitive-token-xyz',
              'X-Api-Key': 'apikey-secret-123',
              'X-Environment': 'staging',
            },
          },
          payload: { orderId: 'ord_123' },
          eventType: 'order.completed',
          signingSecret: 'whsec_sample_secret_key',
        });

        expect(persistedAttemptData).toBeDefined();
        const storedHeaders = persistedAttemptData!.requestHeaders as Record<string, string>;

        // Sensitive credentials must be redacted in persisted DB diagnostics
        expect(storedHeaders['authorization']).toBe('[REDACTED]');
        expect(storedHeaders['x-api-key']).toBe('[REDACTED]');
        expect(storedHeaders['x-relayforge-signature']).toBe('[REDACTED]');

        // Non-sensitive operational metadata must be preserved
        expect(storedHeaders['x-environment']).toBe('staging');
        expect(storedHeaders['x-relayforge-event']).toBe('order.completed');
        expect(storedHeaders['content-type']).toBe('application/json');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('redactSensitiveHeaders utility sanitizes all known credential keys', () => {
      const headers = {
        authorization: 'Bearer token123',
        'X-API-KEY': 'key123',
        'api-key': 'key456',
        'x-auth-token': 'token456',
        'x-access-token': 'token789',
        cookie: 'session=abc',
        'Set-Cookie': 'session=def',
        'proxy-authorization': 'Basic credentials',
        'x-relayforge-signature': 't=123,v1=abc',
        'x-custom-meta': 'safe-data',
      };

      const redacted = redactSensitiveHeaders(headers);

      expect(redacted['authorization']).toBe('[REDACTED]');
      expect(redacted['X-API-KEY']).toBe('[REDACTED]');
      expect(redacted['api-key']).toBe('[REDACTED]');
      expect(redacted['x-auth-token']).toBe('[REDACTED]');
      expect(redacted['x-access-token']).toBe('[REDACTED]');
      expect(redacted['cookie']).toBe('[REDACTED]');
      expect(redacted['Set-Cookie']).toBe('[REDACTED]');
      expect(redacted['proxy-authorization']).toBe('[REDACTED]');
      expect(redacted['x-relayforge-signature']).toBe('[REDACTED]');
      expect(redacted['x-custom-meta']).toBe('safe-data');
    });
  });
});
