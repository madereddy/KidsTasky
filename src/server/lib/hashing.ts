import argon2 from 'argon2';
import bcrypt from 'bcrypt';

const ARGON2_PREFIX = '$argon2id$';
const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];

/**
 * Hash a secret using Argon2id (modern industry standard).
 */
export async function hashSecret(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 4,
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
