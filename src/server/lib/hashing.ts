import argon2 from 'argon2';
import bcrypt from 'bcrypt';

const ARGON2_PREFIX = '$argon2id$';
const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getArgon2Options() {
  const isTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';
  return {
    memoryCost: readPositiveIntEnv('ARGON2_MEMORY_COST', isTest ? 4096 : 65536),
    timeCost: readPositiveIntEnv('ARGON2_TIME_COST', isTest ? 1 : 3),
    parallelism: readPositiveIntEnv('ARGON2_PARALLELISM', isTest ? 1 : 4),
  };
}

/**
 * Hash a secret using Argon2id (modern industry standard).
 */
export async function hashSecret(plaintext: string): Promise<string> {
  const options = getArgon2Options();
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: options.memoryCost,
    timeCost: options.timeCost,
    parallelism: options.parallelism,
  });
}

/**
 * Verify a secret against a stored hash (Argon2id or Bcrypt) or legacy plaintext.
 * Returns { match: boolean, needsUpgrade: boolean }
 */
export async function verifySecret(plaintext: string, stored: string): Promise<{ match: boolean; needsUpgrade: boolean }> {
  if (!stored) return { match: false, needsUpgrade: false };

  // 1. Check if it's an Argon2 hash
  if (stored.startsWith(ARGON2_PREFIX)) {
    try {
      const match = await argon2.verify(stored, plaintext);
      return { match, needsUpgrade: false };
    } catch {
      return { match: false, needsUpgrade: false };
    }
  }

  // 2. Check if it's a Bcrypt hash
  if (BCRYPT_PREFIXES.some(prefix => stored.startsWith(prefix))) {
    try {
      const match = await bcrypt.compare(plaintext, stored);
      return { match, needsUpgrade: match };
    } catch {
      return { match: false, needsUpgrade: false };
    }
  }

  // 3. Fallback: Legacy plaintext (common for 4-digit PINs in older versions)
  const match = plaintext === stored;
  return { match, needsUpgrade: match };
}

/**
 * Convenience helper to verify and return a new hash if the old one was legacy.
 */
export async function verifyAndUpgrade(plaintext: string, stored: string): Promise<{ match: boolean; newHash?: string }> {
  const { match, needsUpgrade } = await verifySecret(plaintext, stored);
  if (match && needsUpgrade) {
    const newHash = await hashSecret(plaintext);
    return { match: true, newHash };
  }
  return { match, newHash: undefined };
}
