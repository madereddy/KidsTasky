export const API_BASE = '/api';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function fetchAPI(endpoint: string, options?: RequestInit, retries = 2) {
  const token = localStorage.getItem('kidtasker_token');
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE + endpoint, {
        ...options,
        headers
      });
      if (!res.ok) {
        // Don't retry client errors (4xx)
        if (res.status >= 400 && res.status < 500) {
          let msg = 'API Error: ' + res.status;
          try {
            const err = await res.json();
            if (err && err.error) msg = err.error;
          } catch (e) {}
          throw new HttpError(res.status, msg);
        }
        // Retry server errors (5xx)
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
          continue;
        }
        let msg = 'API Error: ' + res.status;
        try {
          const err = await res.json();
          if (err && err.error) msg = err.error;
        } catch (e) {}
        throw new HttpError(res.status, msg);
      }
      return await res.json();
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Network error — retry
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      throw new HttpError(0, 'Network error: unable to reach server');
    }
  }
}
