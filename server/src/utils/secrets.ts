import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

/** Generates a high-entropy secret string, e.g. for webhook secrets or API keys. */
export function generateSecret(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/** One-way hash for storing secrets (webhook secrets, API keys) — never store the raw value. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function secretMatches(secret: string, hash: string): boolean {
  const candidate = Buffer.from(hashSecret(secret));
  const expected = Buffer.from(hash);
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

const ALGO = 'aes-256-gcm';

/**
 * Encrypts a value (e.g. a third-party OAuth access token) at rest using
 * WEBHOOK_ENCRYPTION_KEY. Returns null if no key is configured, so callers
 * can decide whether to store the token at all.
 */
export function encryptSecret(plain: string, key: string | undefined): string | null {
  if (!key) return null;
  const keyBuf = createHash('sha256').update(key).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSecret(stored: string, key: string | undefined): string | null {
  if (!key) return null;
  const [ivHex, tagHex, dataHex] = stored.split(':');
  if (!ivHex || !tagHex || !dataHex) return null;
  const keyBuf = createHash('sha256').update(key).digest();
  const decipher = createDecipheriv(ALGO, keyBuf, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
