import pino from 'pino';
import { trace, isSpanContextValid } from '@opentelemetry/api';

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

function traceContextMixin() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  if (!isSpanContextValid(ctx)) return {};
  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
  };
}

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  mixin: isTest ? undefined : traceContextMixin,
  redact: {
    paths: redactPaths,
    censor: '[Redacted]',
  },
});
