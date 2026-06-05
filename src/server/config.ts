import { createHash, randomBytes } from 'crypto';
import { logger } from './lib/logger.js';

let devSecret: string | undefined;
let devSecretKey: Buffer | undefined;
let derivedProdSecretKey: Buffer | undefined;
let warnedDerivedProdSecretKey = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    if (!devSecret) {
      devSecret = randomBytes(64).toString('hex');
    }
    return devSecret;
  }
  return secret;
}

export function getSecretKey(): Buffer {
  const raw = process.env.SECRET_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('SECRET_KEY environment variable is required in production (32-byte hex, 64 chars)');
      }
      if (!derivedProdSecretKey) {
        derivedProdSecretKey = createHash('sha256').update(jwtSecret, 'utf8').digest();
      }
      if (!warnedDerivedProdSecretKey) {
        warnedDerivedProdSecretKey = true;
        logger.warn('secret_key_missing_using_jwt_secret_fallback');
      }
      return derivedProdSecretKey;
    }
    if (!devSecretKey) {
      devSecretKey = randomBytes(32);
    }
    return devSecretKey;
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) throw new Error('SECRET_KEY must be exactly 32 bytes (64 hex characters)');
  return key;
}
