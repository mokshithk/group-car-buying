import crypto from 'node:crypto';

export interface OtpChallengePayload {
  kind: 'otp_challenge';
  email: string;
  type: string;
  code: string;
  attempts: number;
  exp: number;
}

export interface OtpVerifiedPayload {
  kind: 'otp_verified';
  email: string;
  type: string;
  jti: string;
  exp: number;
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Encrypt and authenticate a JSON payload using AES-256-GCM so opaque tokens
 * cannot be inspected or forged by clients or across stateless serverless workers.
 */
export function sealToken(payload: object, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

/**
 * Decrypt and verify an AES-256-GCM token. Returns null on any tampering or format error.
 */
export function unsealToken<T>(token: string, secret: string): T | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return null;
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}

/**
 * Constant-time string comparison for 6-digit OTP verification codes.
 */
export function safeCodeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
