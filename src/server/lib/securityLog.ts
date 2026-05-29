type SecurityLevel = 'info' | 'warn' | 'error';

export function logSecurityEvent(
  event: string,
  details: Record<string, unknown> = {},
  level: SecurityLevel = 'warn'
) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };
  const line = `[security] ${JSON.stringify(payload)}`;
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'info') {
    console.log(line);
    return;
  }
  console.warn(line);
}

