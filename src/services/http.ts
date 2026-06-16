export const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 15000;
import { pushOfflineAction } from '../lib/offline-queue';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface FetchOptions extends RequestInit {
  skipQueue?: boolean;
}

export async function fetchAPI(endpoint: string, options?: FetchOptions, retries = 2) {
  const token = localStorage.getItem('kidtasker_token');
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let didRefresh = false;
  const isAuthEndpoint = endpoint.includes('/auth/');

  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      const signal = options?.signal ?? controller.signal;
      if (!options?.signal) {
        timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      }

      const res = await fetch(API_BASE + endpoint, {
        ...options,
        cache: options?.cache ?? 'no-store',
        headers,
        signal
      });

      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      if (!res.ok) {
        if (res.status === 429 && attempt < retries) {
          const retryAfterHeader = res.headers.get('retry-after');
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : 500 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        if (res.status === 401 && !didRefresh && !isAuthEndpoint) {
          didRefresh = true;
          const currentToken = localStorage.getItem('kidtasker_token');
          if (currentToken) {
            try {
              const r = await fetch(API_BASE + '/auth/refresh', {
                method: 'POST',
                headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' },
              });
              if (r.ok) {
                const data = await r.json();
                if (data.token) {
                  localStorage.setItem('kidtasker_token', data.token);
                  headers.set('Authorization', `Bearer ${data.token}`);
                  attempt = -1; // increments to 0 on next loop tick
                  continue;
                }
              }
            } catch {}
          }
          throw new HttpError(401, 'Session expired');
        }
        if (res.status >= 400 && res.status < 500) {
          let msg = 'API Error: ' + res.status;
          try {
            const err = await res.json();
            if (err && err.error) msg = err.error;
          } catch {}
          throw new HttpError(res.status, msg);
        }
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
          continue;
        }
        let msg = 'API Error: ' + res.status;
        try {
          const err = await res.json();
          if (err && err.error) msg = err.error;
        } catch {}
        throw new HttpError(res.status, msg);
      }
      return await res.json();
    } catch (err: any) {
      if (timeout) clearTimeout(timeout);
      if (err instanceof HttpError) throw err;

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }

      const httpErr = new HttpError(
        0,
        err?.name === 'AbortError'
          ? `Network timeout after ${REQUEST_TIMEOUT_MS / 1000}s`
          : 'Network error: unable to reach server'
      );

      // Intercept network failures and queue mutation requests
      if (!options?.skipQueue && options?.method && options.method !== 'GET') {
        pushOfflineAction({
          type: options.method === 'POST' ? 'CREATE' : (options.method === 'DELETE' ? 'DELETE' : 'UPDATE'),
          entity: endpoint.includes('tasks') ? 'task' : (endpoint.includes('completions') ? 'completion' : 'list_item'),
          endpoint,
          method: options.method,
          body: options.body as string || '',
          description: `Auto-queued ${options.method} to ${endpoint}`
        });
      }

      throw httpErr;
    }
  }
}
