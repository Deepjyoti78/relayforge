/**
 * Retry policy, error classification, and exponential backoff calculations
 * for durable webhook delivery pipeline.
 */

export interface RetryEvaluation {
  shouldRetry: boolean;
  nextRetryAt: Date | null;
  delayMs: number;
  reason: 'RETRYABLE_TRANSIENT' | 'MAX_RETRIES_EXCEEDED' | 'PERMANENT_NON_RETRYABLE';
}

/**
 * Classifies whether a delivery failure is transient (retryable) or permanent.
 */
export function isRetryableFailure(
  statusCode: number | null,
  errorDescription: string | null,
): boolean {
  // If SSRF blocked the target egress, it is a permanent policy violation
  if (errorDescription?.toLowerCase().includes('ssrf') || errorDescription?.toLowerCase().includes('blocked destination')) {
    return false;
  }

  // Network transport errors (timeout, DNS failure, connection reset, connection refused)
  if (statusCode === null) {
    return true;
  }

  // HTTP 408 Request Timeout and HTTP 429 Too Many Requests are transient
  if (statusCode === 408 || statusCode === 429) {
    return true;
  }

  // HTTP 5xx Server Errors (500 Internal Error, 502 Bad Gateway, 503 Unavailable, 504 Gateway Timeout)
  if (statusCode >= 500 && statusCode <= 599) {
    return true;
  }

  // HTTP 4xx Client Errors (400, 401, 403, 404, 405, 410, 422) are permanent configuration/payload rejections
  return false;
}

/**
 * Calculates exponential backoff with additive uniform jitter (0-499ms) to spread retry spikes.
 * Formula: min(maxDelayMs, baseDelayMs * 2^(attempt - 1)) + random_jitter(0, 500ms)
 */
export function calculateNextRetryDelay(
  attemptCount: number,
  baseDelayMs = 1000,
  maxDelayMs = 300000, // 5 minutes max backoff
): number {
  const boundedAttempt = Math.max(1, Math.min(attemptCount, 12));
  const exponential = baseDelayMs * Math.pow(2, boundedAttempt - 1);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(maxDelayMs, exponential + jitter);
}

/**
 * Evaluates whether an outbox message should be retried or routed to the Dead Letter Queue (DLQ).
 */
export function evaluateRetry(params: {
  attemptCount: number;
  maxRetries?: number | undefined;
  statusCode: number | null;
  errorDescription: string | null;
  baseDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
  retryAfterMs?: number | undefined;
}): RetryEvaluation {
  const maxRetries = params.maxRetries ?? 5;
  const retryable = isRetryableFailure(params.statusCode, params.errorDescription);

  if (!retryable) {
    return {
      shouldRetry: false,
      nextRetryAt: null,
      delayMs: 0,
      reason: 'PERMANENT_NON_RETRYABLE',
    };
  }

  if (params.attemptCount >= maxRetries) {
    return {
      shouldRetry: false,
      nextRetryAt: null,
      delayMs: 0,
      reason: 'MAX_RETRIES_EXCEEDED',
    };
  }

  const calculatedDelay = calculateNextRetryDelay(
    params.attemptCount,
    params.baseDelayMs ?? 1000,
    params.maxDelayMs ?? 300000,
  );

  const delayMs =
    params.retryAfterMs && params.retryAfterMs > 0
      ? Math.min(params.maxDelayMs ?? 300000, Math.max(calculatedDelay, params.retryAfterMs))
      : calculatedDelay;

  return {
    shouldRetry: true,
    nextRetryAt: new Date(Date.now() + delayMs),
    delayMs,
    reason: 'RETRYABLE_TRANSIENT',
  };
}
