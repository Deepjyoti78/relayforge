import { BadRequestException } from '@nestjs/common';
import {
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  validateDestinationUrl,
} from '../src/common/security/ssrf.validator';

describe('SSRF Validator', () => {
  describe('isPrivateOrReservedIpv4', () => {
    it('blocks loopback 127.0.0.1 and 127.255.255.255', () => {
      expect(isPrivateOrReservedIpv4('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('127.10.20.30')).toBe(true);
      expect(isPrivateOrReservedIpv4('127.255.255.255')).toBe(true);
    });

    it('blocks RFC 1918 10.0.0.0/8', () => {
      expect(isPrivateOrReservedIpv4('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('10.254.254.254')).toBe(true);
    });

    it('blocks RFC 1918 172.16.0.0/12', () => {
      expect(isPrivateOrReservedIpv4('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('172.24.1.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('172.31.255.255')).toBe(true);
      // 172.32.0.1 is public
      expect(isPrivateOrReservedIpv4('172.32.0.1')).toBe(false);
    });

    it('blocks RFC 1918 192.168.0.0/16', () => {
      expect(isPrivateOrReservedIpv4('192.168.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('192.168.1.100')).toBe(true);
      expect(isPrivateOrReservedIpv4('192.168.255.255')).toBe(true);
    });

    it('blocks Link-Local / Cloud Metadata 169.254.169.254', () => {
      expect(isPrivateOrReservedIpv4('169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIpv4('169.254.1.1')).toBe(true);
    });

    it('blocks 0.0.0.0/8 and broadcast 255.255.255.255', () => {
      expect(isPrivateOrReservedIpv4('0.0.0.0')).toBe(true);
      expect(isPrivateOrReservedIpv4('255.255.255.255')).toBe(true);
    });

    it('blocks multicast 224.0.0.0/4 and reserved 240.0.0.0/4', () => {
      expect(isPrivateOrReservedIpv4('224.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv4('239.255.255.255')).toBe(true);
      expect(isPrivateOrReservedIpv4('240.0.0.1')).toBe(true);
    });

    it('allows valid public IPv4 addresses', () => {
      expect(isPrivateOrReservedIpv4('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIpv4('1.1.1.1')).toBe(false);
      expect(isPrivateOrReservedIpv4('93.184.216.34')).toBe(false);
    });
  });

  describe('isPrivateOrReservedIpv6', () => {
    it('blocks IPv6 loopback and unspecified', () => {
      expect(isPrivateOrReservedIpv6('::1')).toBe(true);
      expect(isPrivateOrReservedIpv6('::')).toBe(true);
    });

    it('blocks IPv4-mapped private IPv6 addresses', () => {
      expect(isPrivateOrReservedIpv6('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv6('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIpv6('::ffff:192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIpv6('::ffff:8.8.8.8')).toBe(false);
    });

    it('blocks Unique Local and Link-Local IPv6 addresses', () => {
      expect(isPrivateOrReservedIpv6('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIpv6('fd12:3456:789a::1')).toBe(true);
      expect(isPrivateOrReservedIpv6('fe80::1')).toBe(true);
    });
  });

  describe('validateDestinationUrl', () => {
    it('rejects empty or non-string inputs', async () => {
      await expect(validateDestinationUrl('')).rejects.toThrow(BadRequestException);
      await expect(validateDestinationUrl(null as unknown as string)).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid or unsupported URL protocols', async () => {
      await expect(validateDestinationUrl('file:///etc/passwd')).rejects.toThrow(
        /Invalid protocol 'file:'/,
      );
      await expect(validateDestinationUrl('ftp://example.com/data')).rejects.toThrow(
        /Invalid protocol 'ftp:'/,
      );
      await expect(validateDestinationUrl('gopher://127.0.0.1')).rejects.toThrow(
        /Invalid protocol 'gopher:'/,
      );
      await expect(validateDestinationUrl('javascript:alert(1)')).rejects.toThrow();
    });

    it('rejects loopback IP addresses', async () => {
      await expect(validateDestinationUrl('http://127.0.0.1:8080/webhook')).rejects.toThrow(
        /blocked private or loopback/,
      );
      await expect(validateDestinationUrl('http://127.0.0.2/webhook')).rejects.toThrow(
        /blocked private or loopback/,
      );
    });

    it('rejects private IPv4 ranges (RFC 1918)', async () => {
      await expect(validateDestinationUrl('http://10.0.0.1/hook')).rejects.toThrow(
        /blocked private or loopback/,
      );
      await expect(validateDestinationUrl('https://172.16.5.10/hook')).rejects.toThrow(
        /blocked private or loopback/,
      );
      await expect(validateDestinationUrl('http://192.168.1.50:9000/hook')).rejects.toThrow(
        /blocked private or loopback/,
      );
    });

    it('rejects cloud metadata IP and internal hostnames', async () => {
      await expect(validateDestinationUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow();
      await expect(validateDestinationUrl('http://metadata.google.internal/computeMetadata/v1/')).rejects.toThrow();
      await expect(validateDestinationUrl('http://localhost:3000/webhook')).rejects.toThrow();
    });

    it('allows private endpoints when allowPrivate is true', async () => {
      const res = await validateDestinationUrl('http://127.0.0.1:3100/v1/test', {
        allowPrivate: true,
      });
      expect(res.url.hostname).toBe('127.0.0.1');
      expect(res.resolvedIps).toContain('127.0.0.1');
    });

    it('accepts valid public domain webhooks', async () => {
      const res = await validateDestinationUrl('https://httpbin.org/post');
      expect(res.url.hostname).toBe('httpbin.org');
      expect(res.resolvedIps.length).toBeGreaterThan(0);
    });
  });
});
