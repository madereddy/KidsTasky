// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pickSafeHeaders, sanitizeLoggedUrl, serializeRequestForLogs } from './httpLogging.js';

describe('httpLogging helpers', () => {
  it('strips query strings from logged URLs', () => {
    expect(sanitizeLoggedUrl('/api/weather?lat=1&lon=2')).toBe('/api/weather');
    expect(sanitizeLoggedUrl('/api/health')).toBe('/api/health');
  });

  it('keeps only safe headers for request logs', () => {
    const safeHeaders = pickSafeHeaders({
      host: 'kids.madereddy.com',
      'user-agent': 'Vitest',
      authorization: 'Bearer secret-token',
      cookie: 'session=secret',
      'x-forwarded-for': '127.0.0.1',
    });

    expect(safeHeaders).toEqual({
      host: 'kids.madereddy.com',
      'user-agent': 'Vitest',
      'x-forwarded-for': '127.0.0.1',
    });
  });

  it('serializes requests without secrets or query strings', () => {
    const serialized = serializeRequestForLogs({
      id: 'req-1',
      method: 'GET',
      originalUrl: '/api/tasks?token=secret',
      headers: {
        host: 'kids.madereddy.com',
        authorization: 'Bearer secret-token',
        cookie: 'session=secret',
        'user-agent': 'Vitest',
      },
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
    });

    expect(serialized).toEqual({
      id: 'req-1',
      method: 'GET',
      url: '/api/tasks',
      remoteAddress: '127.0.0.1',
      remotePort: 12345,
      headers: {
        host: 'kids.madereddy.com',
        'user-agent': 'Vitest',
      },
    });
  });
});
