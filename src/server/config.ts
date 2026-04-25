export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    return 'fallback_secret_for_dev';
  }
  return secret;
}
