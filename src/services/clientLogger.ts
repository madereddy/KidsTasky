type ClientLogLevel = 'info' | 'warn' | 'error';

type ClientLogPayload = {
  level: ClientLogLevel;
  message: string;
  context?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
  timestamp?: string;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function normalizeContext(context?: Record<string, unknown>) {
  if (!context) return undefined;
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      value instanceof Error ? serializeError(value) : value,
    ]),
  );
}

async function postClientLog(payload: ClientLogPayload) {
  try {
    await fetch('/api/client-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        context: normalizeContext(payload.context),
        timestamp: payload.timestamp || new Date().toISOString(),
        url: payload.url || window.location.href,
        userAgent: payload.userAgent || navigator.userAgent,
      }),
      keepalive: true,
    });
  } catch {
    // Logging must never block user flows.
  }
}

function log(level: ClientLogLevel, message: string, context?: Record<string, unknown>) {
  void postClientLog({ level, message, context });
}

export const clientLogger = {
  info(message: string, context?: Record<string, unknown>) {
    log('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    log('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    log('error', message, context);
  },
  errorWithException(message: string, error: unknown, context?: Record<string, unknown>) {
    log('error', message, { ...context, error: serializeError(error) });
  },
};
