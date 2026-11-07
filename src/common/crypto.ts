import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generates an API key with a human-readable prefix, a masked preview prefix,
 * and a SHA-256 hash for secure database storage.
 */
export function generateApiKey(prefix = 'rf_live_'): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const randomPart = randomBytes(24).toString('base64url');
  const rawKey = `${prefix}${randomPart}`;
  // Store the prefix plus the first 4 characters of the random part for display (e.g. rf_live_a1b2...)
  const keyPrefix = rawKey.slice(0, prefix.length + 4);
  const keyHash = hashToken(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Generates a webhook signing secret with whsec_ prefix.
 */
export function generateWebhookSecret(): {
  rawSecret: string;
  secretPreview: string;
} {
  const randomPart = randomBytes(24).toString('base64url');
  const rawSecret = `whsec_${randomPart}`;
  const secretPreview = rawSecret.slice(0, 10);
  return { rawSecret, secretPreview };
}

/**
 * AES-256-GCM authenticated encryption for webhook signing secrets and credentials.
 */
export function encryptSecret(
  plaintext: string,
  key: Buffer,
): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * AES-256-GCM authenticated decryption. Throws if data was tampered with.
 */
export function decryptSecret(
  ciphertext: string,
  iv: string,
  tag: string,
  key: Buffer,
): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Computes an HMAC-SHA256 signature over payload using secret.
 */
export function computeHmacSignature(payload: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Constant-time safe signature verification supporting both:
 * 1. Timestamped scheme: t=123456789,v1=...
 * 2. Standard scheme: sha256=... or raw hex
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret) return false;

  const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');

  // Check if header contains timestamped format (e.g. t=123456,v1=abcdef)
  if (signatureHeader.includes('t=') && signatureHeader.includes('v1=')) {
    const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, item) => {
      const [k, v] = item.trim().split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    const timestampStr = parts.t;
    const providedSig = parts.v1;
    if (!timestampStr || !providedSig) return false;

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Check tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    const expectedSig = computeHmacSignature(`${timestamp}.${payloadString}`, secret);
    if (expectedSig.length !== providedSig.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(providedSig, 'hex'));
    } catch {
      return false;
    }
  }

  // Raw or sha256= format
  const cleanProvided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader.trim();

  const expectedSig = computeHmacSignature(payloadString, secret);
  if (expectedSig.length !== cleanProvided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(cleanProvided, 'hex'));
  } catch {
    return false;
  }
}
