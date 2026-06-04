type HeaderValue = string | string[] | undefined;

const SAFE_HEADER_NAMES = [
  'host',
  'user-agent',
  'content-type',
  'content-length',
  'accept',
  'accept-encoding',
  'accept-language',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cdn-loop',
  'via',
];

export function sanitizeLoggedUrl(url?: string): string {
  if (!url) return '/';
  const queryIndex = url.indexOf('?');
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
}

export function pickSafeHeaders(headers: Record<string, HeaderValue>): Record<string, string | string[]> {
  const safeHeaders: Record<string, string | string[]> = {};
  for (const headerName of SAFE_HEADER_NAMES) {
    const value = headers[headerName];
    if (value !== undefined) {
      safeHeaders[headerName] = value;
    }
  }
  return safeHeaders;
}

export function serializeRequestForLogs(req: {
  id?: string | number;
  method?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, HeaderValue>;
  remoteAddress?: string;
  remotePort?: number;
 }) {
  return {
    id: req.id,
    method: req.method,
    url: sanitizeLoggedUrl(req.originalUrl || req.url),
    remoteAddress: req.remoteAddress,
    remotePort: req.remotePort,
    headers: pickSafeHeaders(req.headers),
  };
}
