import { logger } from './logger.js';

type SecurityLevel = 'info' | 'warn' | 'error';

export function logSecurityEvent(
  event: string,
  details: Record<string, unknown> = {},
  level: SecurityLevel = 'warn'
) {
  const payload = { event, ...details };
  logger[level](payload, 'security');
}
