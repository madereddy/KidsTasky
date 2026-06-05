// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadConfigModule() {
  vi.resetModules();
  return import('./config.js');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('getSecretKey', () => {
  it('derives a stable production fallback from JWT_SECRET when SECRET_KEY is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'jwt-secret-for-test';
    delete process.env.SECRET_KEY;

    const { getSecretKey } = await loadConfigModule();
    const first = getSecretKey();
    const second = getSecretKey();

    expect(first.equals(second)).toBe(true);
    expect(first.length).toBe(32);
  });

  it('throws in production when both SECRET_KEY and JWT_SECRET are missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.SECRET_KEY;

    const { getSecretKey } = await loadConfigModule();
    expect(() => getSecretKey()).toThrow('SECRET_KEY environment variable is required in production');
  });
});
