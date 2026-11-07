import * as dns from 'node:dns';
import * as net from 'node:net';
import { BadRequestException } from '@nestjs/common';

export interface SsrfValidationOptions {
  allowPrivate?: boolean;
}

/**
 * Checks if an IPv4 address string falls into any private, loopback, link-local,
 * multicast, or reserved ranges.
 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 is treated as unsafe
  }

  const [b0, b1, b2, b3] = parts as [number, number, number, number];

  // 0.0.0.0/8 (Current network / "this" host)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (b0 === 10) return true;

  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-Local / APIPA / Cloud Metadata 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && b2 === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && b2 === 2) return true;

  // 192.88.99.0/24 (6to4 Relay Anycast)
  if (b0 === 192 && b1 === 88 && b2 === 99) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 (Benchmarking)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && b2 === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (b0 >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address string falls into any private, loopback, link-local,
 * multicast, or reserved ranges.
 */
export function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4-mapped IPv6 address (e.g. ::ffff:192.168.1.1)
  if (normalized.startsWith('::ffff:')) {
    const rawIpv4 = normalized.slice(7);
    if (net.isIPv4(rawIpv4)) {
      return isPrivateOrReservedIpv4(rawIpv4);
    }
  }

  // Loopback (::1)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified (::)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // Link-Local Unicast (fe80::/10 -> fe80:: through febf::)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;

  // Unique Local Address (fc00::/7 -> fc00:: through fdff::)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) return true;

  // Documentation (2001:db8::/32)
  if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0db8:')) return true;

  // Discard Prefix (100::/64)
  if (normalized.startsWith('100::') || normalized.startsWith('0100:')) return true;

  return false;
}

/**
 * List of forbidden hostnames (cloud metadata, internal DNS names).
 */
const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
  '100.100.100.200',
]);

/**
 * Validates a target URL against SSRF attacks.
 * Rejects non-HTTP(S) schemes, localhost, private IP ranges, cloud metadata services,
 * and unresolvable hostnames.
 */
export async function validateDestinationUrl(
  urlInput: string,
  options: SsrfValidationOptions = {},
): Promise<{ url: URL; resolvedIps: string[] }> {
  if (!urlInput || typeof urlInput !== 'string') {
    throw new BadRequestException('Destination URL must be a non-empty string');
  }

  let parsed: URL;
  try {
    parsed = new URL(urlInput);
  } catch {
    throw new BadRequestException('Invalid destination URL format');
  }

  // 1. Protocol validation: Only http: and https: allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(
      `Invalid protocol '${parsed.protocol}'. Destinations only support 'http:' and 'https:'.`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!hostname) {
    throw new BadRequestException('Destination URL hostname cannot be empty');
  }

  // 2. Disallow explicit forbidden hostnames
  if (FORBIDDEN_HOSTNAMES.has(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    if (!options.allowPrivate) {
      throw new BadRequestException(
        `Destination URL hostname '${hostname}' is disallowed by SSRF security policy.`,
      );
    }
  }

  // 3. DNS resolution & IP range checks
  let addresses: dns.LookupAddress[] = [];

  if (net.isIP(hostname)) {
    // Hostname is already an IP address
    addresses = [{ address: hostname, family: net.isIP(hostname) }];
  } else {
    try {
      addresses = await dns.promises.lookup(hostname, { all: true });
    } catch {
      throw new BadRequestException(
        `Unable to resolve destination hostname '${hostname}'. Host must have valid public DNS records.`,
      );
    }
  }

  if (addresses.length === 0) {
    throw new BadRequestException(
      `Destination hostname '${hostname}' resolved to 0 IP addresses.`,
    );
  }

  const resolvedIps = addresses.map((a) => a.address);

  if (!options.allowPrivate) {
    for (const { address } of addresses) {
      if (net.isIPv4(address)) {
        if (isPrivateOrReservedIpv4(address)) {
          throw new BadRequestException(
            `Destination URL resolved to blocked private or loopback IPv4 address (${address}).`,
          );
        }
      } else if (net.isIPv6(address)) {
        if (isPrivateOrReservedIpv6(address)) {
          throw new BadRequestException(
            `Destination URL resolved to blocked private or loopback IPv6 address (${address}).`,
          );
        }
      } else {
        throw new BadRequestException(`Unrecognized IP address family for address: ${address}`);
      }
    }
  }

  return { url: parsed, resolvedIps };
}
