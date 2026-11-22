/**
 * Shared header utility functions used by both delivery and destination modules.
 * Extracted here to avoid circular module dependencies.
 */

/**
 * Headers that RelayForge generates and owns, or transport headers that must not
 * be controlled by custom configuration. User-supplied custom destination
 * headers must never override these values, both at validation time (create/update)
 * and at the final delivery boundary.
 */
const RESERVED_DELIVERY_HEADERS = new Set([
  // Transport & HTTP core
  'host',
  'content-type',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'idempotency-key',
  'user-agent',
  // RelayForge-generated operational headers
  'x-relayforge-signature',
  'x-relayforge-timestamp',
  'x-relayforge-delivery',
  'x-relayforge-delivery-id',
  'x-relayforge-attempt',
  'x-relayforge-attempt-id',
  'x-relayforge-event',
  'x-relayforge-event-id',
  'x-relayforge-destination-id',
]);

/**
 * Returns true if `headerName` (case-insensitive) is a RelayForge-reserved
 * delivery header that must never be overridden by user-supplied configuration.
 */
export function isReservedDeliveryHeader(headerName: string): boolean {
  const lower = headerName.toLowerCase();
  if (RESERVED_DELIVERY_HEADERS.has(lower)) return true;
  if (lower.startsWith('proxy-')) return true;
  return false;
}

/**
 * Sensitive request header names (case-insensitive) whose values must be
 * redacted before the header map is persisted in `delivery_attempts` or
 * returned in API responses.
 */
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-access-token',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]);

/**
 * Returns a copy of `headers` with sensitive credential values replaced by
 * the redaction sentinel. The `x-relayforge-signature` header is also stripped
 * so that signing material is never stored in delivery diagnostics.
 */
export function redactSensitiveHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_HEADER_NAMES.has(lower)) {
      result[k] = '[REDACTED]';
    } else if (lower === 'x-relayforge-signature') {
      // Strip signing material — the signature is not useful for diagnostics
      // and leaking it into storage widens the blast radius of a DB breach.
      result[k] = '[REDACTED]';
    } else {
      result[k] = v;
    }
  }
  return result;
}
