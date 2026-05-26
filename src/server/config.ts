import { randomBytes } from 'crypto';

let devSecret: string | undefined;

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
