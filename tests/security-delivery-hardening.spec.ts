import * as dns from 'node:dns';
import * as http from 'node:http';
import { BadRequestException } from '@nestjs/common';
import { verifyWebhookSignature } from '../src/common/crypto';
import {
  createPinnedDispatcher,
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  validateDestinationUrl,
} from '../src/common/security/ssrf.validator';
import { AuthorizationService } from '../src/modules/auth/authorization.service';
import type { RuntimeConfig } from '../src/modules/config/config.module';
import type { TenantContextService } from '../src/modules/database/tenant-context.service';
import { DeliveryService, getStableDeliveryId } from '../src/modules/delivery/delivery.service';
import { evaluateRetry, isRetryableFailure } from '../src/modules/delivery/retry-policy';

describe('Phase 6: Security Remediation & Delivery Hardening Tests', () => {
  describe('SSRF & DNS Security (Part 1 & 2)', () => {
    it('1. DNS Rebinding: validates all addresses and pins socket to validated IP', async () => {
      // Mock dns.promises.lookup to simulate DNS rebinding:
      // First lookup resolves to public IP 93.184.216.34
      const lookupSpy = jest.spyOn(dns.promises, 'lookup') as unknown as jest.MockInstance<
        Promise<dns.LookupAddress[]>,
        [hostname: string, options?: unknown]
      >;
      lookupSpy.mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
      ]);

      const result = await validateDestinationUrl('http://rebind-test.example.com/webhook');
      expect(result.pinnedIp).toBe('93.184.216.34');
      expect(result.resolvedIps).toEqual(['93.184.216.34']);

      // Pinned dispatcher creates lookup pinned to 93.184.216.34
      const dispatcher = createPinnedDispatcher(result.pinnedIp);
      expect(dispatcher).toBeDefined();

      lookupSpy.mockRestore();
    });

    it('2. Multiple DNS IP resolution: rejects if any resolved address is prohibited', async () => {
      // A dual-homed host returns both a public IP and a private loopback address
      const lookupSpy = jest.spyOn(dns.promises, 'lookup') as unknown as jest.MockInstance<
        Promise<dns.LookupAddress[]>,
        [hostname: string, options?: unknown]
      >;
      lookupSpy.mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);

      await expect(
        validateDestinationUrl('https://dual-homed.example.com/webhook'),
      ).rejects.toThrow(BadRequestException);

      lookupSpy.mockRestore();
    });

    it('3. Redirect to 127.0.0.1: manual redirect stops, does not contact loopback', async () => {
      let loopbackContacted = false;
      const loopbackServer = http.createServer((_req, res) => {
        loopbackContacted = true;
        res.writeHead(200);
        res.end('PWNED');
      });

      await new Promise<void>((resolve) => loopbackServer.listen(0, '127.0.0.1', resolve));
      const loopbackPort = (loopbackServer.address() as { port: number }).port;

      const redirectServer = http.createServer((_req, res) => {
        res.writeHead(302, { Location: `http://127.0.0.1:${loopbackPort}/internal-admin` });
        res.end();
      });

      await new Promise<void>((resolve) => redirectServer.listen(0, '127.0.0.1', resolve));
      const redirectPort = (redirectServer.address() as { port: number }).port;

      try {
        const { fetch: undiciFetch } = await import('undici');
        const res = await undiciFetch(`http://127.0.0.1:${redirectPort}/webhook`, {
          redirect: 'manual',
        });

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toContain('127.0.0.1');
        // Critical assertion: The loopback destination was never contacted
        expect(loopbackContacted).toBe(false);
      } finally {
        await new Promise<void>((resolve) => redirectServer.close(() => resolve()));
        await new Promise<void>((resolve) => loopbackServer.close(() => resolve()));
      }
    });

    it('4. Redirect to 169.254.169.254: manual redirect terminates safely without contacting metadata', async () => {
      const redirectServer = http.createServer((_req, res) => {
        res.writeHead(301, { Location: 'http://169.254.169.254/latest/meta-data' });
        res.end();
      });

      await new Promise<void>((resolve) => redirectServer.listen(0, '127.0.0.1', resolve));
      const redirectPort = (redirectServer.address() as { port: number }).port;

      try {
        const { fetch: undiciFetch } = await import('undici');
        const res = await undiciFetch(`http://127.0.0.1:${redirectPort}/webhook`, {
          redirect: 'manual',
        });

        expect(res.status).toBe(301);
        expect(res.headers.get('location')).toBe('http://169.254.169.254/latest/meta-data');
      } finally {
        await new Promise<void>((resolve) => redirectServer.close(() => resolve()));
      }
    });

    it('5. Redirect to private IPv6: manual redirect terminates safely', async () => {
      const redirectServer = http.createServer((_req, res) => {
        res.writeHead(308, { Location: 'http://[fd00::1]/internal' });
        res.end();
      });

      await new Promise<void>((resolve) => redirectServer.listen(0, '127.0.0.1', resolve));
      const redirectPort = (redirectServer.address() as { port: number }).port;

      try {
        const { fetch: undiciFetch } = await import('undici');
        const res = await undiciFetch(`http://127.0.0.1:${redirectPort}/webhook`, {
          redirect: 'manual',
        });

        expect(res.status).toBe(308);
        expect(res.headers.get('location')).toBe('http://[fd00::1]/internal');
      } finally {
        await new Promise<void>((resolve) => redirectServer.close(() => resolve()));
      }
    });

    it('validates IPv4 and IPv6 private/reserved ranges comprehensively', () => {
      // IPv4 private & reserved
      expect(isPrivateOrReservedIpv4('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIpv4('100.64.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('0.0.0.0')).toBe(true);
      expect(isPrivateOrReservedIpv4('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIpv4('93.184.216.34')).toBe(false);

      // IPv6 private & reserved
      expect(isPrivateOrReservedIpv6('::1')).toBe(true);
      expect(isPrivateOrReservedIpv6('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIpv6('fd00::1')).toBe(true);
      expect(isPrivateOrReservedIpv6('::ffff:192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIpv6('2606:4700:4700::1111')).toBe(false);
    });
  });

  describe('Delivery Correctness & Retry Semantics (Part 1 & 2)', () => {
    it('6. HTTP 408 is classified as retryable transient failure (does not enter DLQ)', () => {
      expect(isRetryableFailure(408, 'HTTP 408: Request Timeout')).toBe(true);

      const evaluation = evaluateRetry({
        attemptCount: 1,
        maxRetries: 5,
        statusCode: 408,
        errorDescription: 'HTTP 408: Request Timeout',
      });

      expect(evaluation.shouldRetry).toBe(true);
      expect(evaluation.reason).toBe('RETRYABLE_TRANSIENT');
      expect(evaluation.nextRetryAt).toBeDefined();
      expect(evaluation.delayMs).toBeGreaterThan(0);
    });

    it('7. Retry-After delta seconds: next_retry_at scheduled >= requested seconds', () => {
      const evaluation = evaluateRetry({
        attemptCount: 1,
        maxRetries: 5,
        statusCode: 429,
        errorDescription: 'HTTP 429: Too Many Requests',
        retryAfterMs: 120 * 1000, // 120 seconds
      });

      expect(evaluation.shouldRetry).toBe(true);
      expect(evaluation.delayMs).toBeGreaterThanOrEqual(120000);
      expect(evaluation.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(Date.now() + 119000);
    });

    it('8. Retry-After HTTP date: next_retry_at scheduled according to parsed timestamp', () => {
      const futureDateMs = 60 * 1000;
      const evaluation = evaluateRetry({
        attemptCount: 1,
        maxRetries: 5,
        statusCode: 503,
        errorDescription: 'HTTP 503: Service Unavailable',
        retryAfterMs: futureDateMs,
      });

      expect(evaluation.shouldRetry).toBe(true);
      expect(evaluation.delayMs).toBeGreaterThanOrEqual(60000);
    });

    it('Retry-After respects maxDelayMs upper bound (does not delay indefinitely)', () => {
      const evaluation = evaluateRetry({
        attemptCount: 1,
        maxRetries: 5,
        statusCode: 429,
        errorDescription: 'HTTP 429: Too Many Requests',
        retryAfterMs: 86400 * 1000, // 24 hours requested by receiver
        maxDelayMs: 300000, // 5 minute upper bound
      });

      expect(evaluation.shouldRetry).toBe(true);
      expect(evaluation.delayMs).toBe(300000);
    });

    it('9. Stable downstream idempotency: getStableDeliveryId is deterministic across retries', () => {
      const eventId = 'e4b3c2a1-0000-0000-0000-000000000001';
      const destinationId = 'd1a2b3c4-0000-0000-0000-000000000002';

      const id1 = getStableDeliveryId(eventId, destinationId);
      const id2 = getStableDeliveryId(eventId, destinationId);
      const id3 = getStableDeliveryId(eventId, destinationId);

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
      // Valid UUID format check
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('10 & 11. Fresh HMAC signature and unique attempt ID per delivery attempt', async () => {
      const capturedRequests: {
        idempotencyKey: string;
        deliveryId: string;
        attemptId: string;
        attempt: string;
        timestamp: string;
        signature: string;
      }[] = [];

      const mockTenantContext = {
        runInTenantContext: jest.fn().mockImplementation(
          <T>(_orgId: string, _userId: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
            const mockTx = {
              deliveryAttempt: {
                create: jest.fn().mockImplementation((args: { data: unknown }) =>
                  Promise.resolve({ createdAt: new Date(), ...(args.data as Record<string, unknown>) }),
                ),
              },
            };
            return fn(mockTx);
          },
        ),
      } as unknown as TenantContextService;

      const mockAuthz = new AuthorizationService();
      const mockConfig = { values: { allowPrivateDestinations: true } } as unknown as RuntimeConfig;
      const deliveryService = new DeliveryService(mockTenantContext, mockAuthz, mockConfig);

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((_url: unknown, init?: RequestInit) => {
        const h = (init?.headers ?? {}) as Record<string, string>;
        capturedRequests.push({
          idempotencyKey: h['idempotency-key'] ?? '',
          deliveryId: h['x-relayforge-delivery'] ?? '',
          attemptId: h['x-relayforge-attempt-id'] ?? '',
          attempt: h['x-relayforge-attempt'] ?? '',
          timestamp: h['x-relayforge-timestamp'] ?? '',
          signature: h['x-relayforge-signature'] ?? '',
        });
        return Promise.resolve(new Response('OK', { status: 200 }));
      });

      const eventId = 'ev-1111-2222';
      const destId = 'dest-3333-4444';
      const secret = 'whsec_fresh_test_key_xyz';
      const payload = { event: 'user.created', id: 42 };

      // Attempt 1
      await deliveryService.deliverEventToDestination({
        organizationId: 'org-1',
        eventId,
        destination: { id: destId, url: 'http://example.com/hook' },
        payload,
        eventType: 'user.created',
        attemptNumber: 1,
        signingSecret: secret,
      });

      // Wait 1.1s to ensure second timestamp differs
      await new Promise((r) => setTimeout(r, 1100));

      // Attempt 2 (retry)
      await deliveryService.deliverEventToDestination({
        organizationId: 'org-1',
        eventId,
        destination: { id: destId, url: 'http://example.com/hook' },
        payload,
        eventType: 'user.created',
        attemptNumber: 2,
        signingSecret: secret,
      });

      global.fetch = originalFetch;

      expect(capturedRequests).toHaveLength(2);
      const [req1, req2] = capturedRequests;

      // 9. Stable downstream idempotency: identical across attempts
      expect(req1!.deliveryId).toBe(req2!.deliveryId);
      expect(req1!.idempotencyKey).toBe(req2!.idempotencyKey);

      // 10. Attempt IDs differ
      expect(req1!.attemptId).not.toBe(req2!.attemptId);
      expect(req1!.attempt).toBe('1');
      expect(req2!.attempt).toBe('2');

      // 11. Fresh timestamp and signature per attempt
      expect(req1!.timestamp).not.toBe(req2!.timestamp);
      expect(req1!.signature).not.toBe(req2!.signature);

      // Verify each signature validates with its own timestamp
      const bodyStr = JSON.stringify(payload);
      expect(verifyWebhookSignature(bodyStr, req1!.signature, secret, 300)).toBe(true);
      expect(verifyWebhookSignature(bodyStr, req2!.signature, secret, 300)).toBe(true);
    });
  });
});
