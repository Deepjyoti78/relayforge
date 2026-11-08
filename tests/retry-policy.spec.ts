import {
  calculateNextRetryDelay,
  evaluateRetry,
  isRetryableFailure,
} from '../src/modules/delivery/retry-policy';

describe('Milestone 3 Option 3: Retry Policy & Failure Classification', () => {
  describe('isRetryableFailure', () => {
    it('classifies network transport errors (null status) as retryable', () => {
      expect(isRetryableFailure(null, 'Network timeout after 10000ms')).toBe(true);
      expect(isRetryableFailure(null, 'Connection refused')).toBe(true);
      expect(isRetryableFailure(null, 'DNS lookup failed')).toBe(true);
    });

    it('classifies HTTP 408 Request Timeout and HTTP 429 Rate Limit as retryable', () => {
      expect(isRetryableFailure(408, 'Request Timeout')).toBe(true);
      expect(isRetryableFailure(429, 'Too many requests')).toBe(true);
    });

    it('classifies HTTP 5xx Server Errors as retryable', () => {
      expect(isRetryableFailure(500, 'Internal Server Error')).toBe(true);
      expect(isRetryableFailure(502, 'Bad Gateway')).toBe(true);
      expect(isRetryableFailure(503, 'Service Unavailable')).toBe(true);
      expect(isRetryableFailure(504, 'Gateway Timeout')).toBe(true);
    });

    it('classifies HTTP 4xx Client Errors as permanent (non-retryable)', () => {
      expect(isRetryableFailure(400, 'Bad Request')).toBe(false);
      expect(isRetryableFailure(401, 'Unauthorized')).toBe(false);
      expect(isRetryableFailure(403, 'Forbidden')).toBe(false);
      expect(isRetryableFailure(404, 'Not Found')).toBe(false);
      expect(isRetryableFailure(405, 'Method Not Allowed')).toBe(false);
      expect(isRetryableFailure(410, 'Gone')).toBe(false);
      expect(isRetryableFailure(422, 'Unprocessable Entity')).toBe(false);
    });

    it('classifies SSRF blocked destinations as non-retryable policy rejections', () => {
      expect(isRetryableFailure(null, 'SSRF validation failed: Blocked destination address')).toBe(false);
      expect(isRetryableFailure(500, 'Blocked destination IP range')).toBe(false);
    });
  });

  describe('calculateNextRetryDelay', () => {
    it('calculates exponential backoff with bounded jitter', () => {
      const delay1 = calculateNextRetryDelay(1, 1000);
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1500);

      const delay2 = calculateNextRetryDelay(2, 1000);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2500);

      const delay3 = calculateNextRetryDelay(3, 1000);
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(4500);
    });

    it('caps retry delay at maxDelayMs', () => {
      const maxDelay = 60000;
      const delayLarge = calculateNextRetryDelay(10, 1000, maxDelay);
      expect(delayLarge).toBeLessThanOrEqual(maxDelay);
    });
  });

  describe('evaluateRetry (DLQ & Scheduling)', () => {
    it('schedules retry for transient failure within max retries', () => {
      const result = evaluateRetry({
        attemptCount: 2,
        maxRetries: 5,
        statusCode: 503,
        errorDescription: 'Service Unavailable',
      });

      expect(result.shouldRetry).toBe(true);
      expect(result.reason).toBe('RETRYABLE_TRANSIENT');
      expect(result.nextRetryAt).toBeInstanceOf(Date);
      expect(result.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
      expect(result.delayMs).toBeGreaterThanOrEqual(2000);
    });

    it('routes to Dead Letter Queue (DLQ) when maxRetries is exceeded', () => {
      const result = evaluateRetry({
        attemptCount: 5,
        maxRetries: 5,
        statusCode: 503,
        errorDescription: 'Service Unavailable',
      });

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('MAX_RETRIES_EXCEEDED');
      expect(result.nextRetryAt).toBeNull();
    });

    it('routes immediately to DLQ without retrying for permanent failures', () => {
      const result = evaluateRetry({
        attemptCount: 1,
        maxRetries: 5,
        statusCode: 404,
        errorDescription: 'Target webhook endpoint not found',
      });

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('PERMANENT_NON_RETRYABLE');
      expect(result.nextRetryAt).toBeNull();
    });

    it('respects retryAfterMs when specified by destination Retry-After header', () => {
      const result = evaluateRetry({
        attemptCount: 1,
        maxRetries: 5,
        statusCode: 429,
        errorDescription: 'Rate limited',
        retryAfterMs: 15000,
      });

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(15000);
      expect(result.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(Date.now() + 14900);
    });

    it('caps retryAfterMs at maxDelayMs', () => {
      const result = evaluateRetry({
        attemptCount: 1,
        maxRetries: 5,
        statusCode: 429,
        errorDescription: 'Rate limited',
        maxDelayMs: 60000,
        retryAfterMs: 120000,
      });

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(60000);
    });
  });
});
