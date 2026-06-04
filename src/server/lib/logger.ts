import pino from 'pino';

const isTest = !!process.env.VITEST || process.env.NODE_ENV === 'test';
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.set-cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers.set-cookie',
  'authorization',
  'cookie',
  'set-cookie',
  '*.authorization',
  '*.cookie',
  '*.set-cookie',
  '*.password',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.jwt',
  '*.secret',
  '*.apiKey',
];

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  redact: {
    paths: redactPaths,
    censor: '[Redacted]',
  },
});
