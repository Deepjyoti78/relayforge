import { ForbiddenException } from '@nestjs/common';
import { verifyWebhookSignature } from '../src/common/crypto';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import type { RuntimeConfig } from '../src/modules/config/config.module';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';
import { DeliveryService } from '../src/modules/delivery/delivery.service';

describe('Milestone 3 Option 2: DeliveryService Unit Tests', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const destId = '33333333-3333-3333-3333-333333333333';
  const eventId = '44444444-4444-4444-4444-444444444444';

  let deliveryService: DeliveryService;
  let mockTenantContext: jest.Mocked<TenantContextService>;
  let mockAuthz: AuthorizationService;
  let mockConfig: RuntimeConfig;

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
                findFirst: jest.fn().mockResolvedValue({
                  id: destId,
                  organizationId: orgId,
                  name: 'Target Webhook',
                  url: 'https://example.com/webhooks',
                  httpMethod: 'POST',
                  headers: { 'X-Custom-Env': 'production' },
                  rateLimitPerSecond: 100,
                  timeoutMs: 5000,
                  isActive: true,
                }),
              },
              event: {
                create: jest.fn().mockResolvedValue({ id: eventId }),
              },
              endpoint: {
                findFirst: jest.fn().mockResolvedValue({ id: 'ep-1' }),
              },
              deliveryAttempt: {
                create: jest.fn().mockImplementation((args: { data: unknown }) =>
                  Promise.resolve({
                    createdAt: new Date(),
                    ...(args.data as Record<string, unknown>),
                  }),
                ),
                findMany: jest.fn().mockResolvedValue([
                  {
                    id: 'att-1',
                    organizationId: orgId,
                    eventId,
                    destinationId: destId,
                    outboxMessageId: null,
                    attemptNumber: 1,
                    status: 'SUCCESS',
                    statusCode: 200,
                    latencyMs: 35,
                    requestUrl: 'https://example.com/webhooks',
                    requestMethod: 'POST',
                    requestHeaders: {},
                    responseHeaders: {},
                    responseBodyPreview: '{"ok":true}',
                    errorDescription: null,
                    createdAt: new Date(),
                  },
                ]),
              },
            };
            return fn(mockTx);
          },
        ),
    } as unknown as jest.Mocked<TenantContextService>;

    mockAuthz = new AuthorizationService();
    mockConfig = {
      values: {
        allowPrivateDestinations: true, // Allow localhost / arbitrary URLs in unit tests
      },
    } as unknown as RuntimeConfig;

    deliveryService = new DeliveryService(mockTenantContext, mockAuthz, mockConfig);
  });

  describe('deliverEventToDestination', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('successfully delivers webhook and records SUCCESS delivery attempt', async () => {
      let capturedHeaders: Record<string, string> | undefined;
      let capturedBody: string | undefined;

      global.fetch = jest.fn().mockImplementation((_url, init?: RequestInit) => {
        capturedHeaders = init?.headers as Record<string, string>;
        capturedBody = init?.body as string;
        return Promise.resolve(
          new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const signingSecret = 'whsec_test_secret_key_12345';
      const payload = { action: 'payment.completed', amount: 4200 };

      const attempt = await deliveryService.deliverEventToDestination({
        organizationId: orgId,
        eventId,
        destination: {
          id: destId,
          url: 'https://example.com/webhooks',
          httpMethod: 'POST',
          headers: { 'X-Partner': 'Stripe' },
          timeoutMs: 5000,
        },
        payload,
        eventType: 'payment.completed',
        signingSecret,
      });

      expect(attempt.status).toBe('SUCCESS');
      expect(attempt.statusCode).toBe(200);
      expect(attempt.responseBodyPreview).toContain('received');
      expect(attempt.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify outbound HMAC signature header was sent
      const headersObj = capturedHeaders as Record<string, string>;
      expect(headersObj['x-relayforge-signature']).toBeDefined();
      expect(headersObj['x-relayforge-event']).toBe('payment.completed');
      expect(headersObj['x-partner']).toBe('Stripe');

      // Verify the signature can be verified with RelayForge signature verifier
      const isValid = verifyWebhookSignature(
        capturedBody!,
        headersObj['x-relayforge-signature']!,
        signingSecret,
      );
      expect(isValid).toBe(true);
    });

    it('captures HTTP error status and records FAILED attempt', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        new Response('Service Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        }),
      );

      const attempt = await deliveryService.deliverEventToDestination({
        organizationId: orgId,
        eventId,
        destination: {
          id: destId,
          url: 'https://example.com/webhooks',
        },
        payload: { test: true },
        eventType: 'test.event',
      });

      expect(attempt.status).toBe('FAILED');
      expect(attempt.statusCode).toBe(503);
      expect(attempt.errorDescription).toContain('503');
      expect(attempt.responseBodyPreview).toBe('Service Unavailable');
    });

    it('handles transport timeout safely', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';
      global.fetch = jest.fn().mockRejectedValue(timeoutError);

      const attempt = await deliveryService.deliverEventToDestination({
        organizationId: orgId,
        eventId,
        destination: {
          id: destId,
          url: 'https://example.com/webhooks',
          timeoutMs: 2000,
        },
        payload: { test: true },
        eventType: 'test.event',
      });

      expect(attempt.status).toBe('UNKNOWN');
      expect(attempt.statusCode).toBeNull();
      expect(attempt.errorDescription).toContain('timed out');
    });
  });

  describe('testDestinationPing & listDeliveryAttempts', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('dispatches ping test event to destination', async () => {
      const result = await deliveryService.testDestinationPing(orgId, userId, destId);
      expect(result.status).toBe('SUCCESS');
      expect(result.requestMethod).toBe('POST');
    });

    it('returns delivery history list', async () => {
      const list = await deliveryService.listDeliveryAttempts(orgId, userId);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe('att-1');
      expect(list[0]?.status).toBe('SUCCESS');
    });

    it('rejects test ping for VIEWER role', async () => {
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

      await expect(deliveryService.testDestinationPing(orgId, userId, destId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('replays delivery by re-enqueuing outbox message', async () => {
      mockTenantContext.runInTenantContext = jest
        .fn()
        .mockImplementation(
          <T>(_orgId: string, _userId: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
            const mockTx = {
              membership: {
                findUnique: jest.fn().mockResolvedValue({ role: 'DEVELOPER' }),
              },
              deliveryAttempt: {
                findFirst: jest.fn().mockResolvedValue({
                  id: 'att-1',
                  organizationId: orgId,
                  eventId: eventId,
                  outboxMessageId: 'outbox-1',
                }),
              },
              $queryRaw: jest.fn().mockResolvedValue([
                { replayed_outbox_id: 'outbox-1', replayed_event_id: eventId, new_status: 'PENDING' },
              ]),
            };
            return fn(mockTx);
          },
        );

      const result = await deliveryService.replayDelivery(orgId, userId, 'att-1');
      expect(result.success).toBe(true);
      expect(result.outboxMessageId).toBe('outbox-1');
      expect(result.status).toBe('PENDING');
    });

    it('rejects replay for VIEWER role', async () => {
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

      await expect(deliveryService.replayDelivery(orgId, userId, 'att-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
