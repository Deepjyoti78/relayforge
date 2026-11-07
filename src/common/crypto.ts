import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

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
