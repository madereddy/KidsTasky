export const API_BASE = '/api';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const token = localStorage.getItem('kidtasker_token');
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(API_BASE + endpoint, {
    ...options,
    headers
  });
  if (!res.ok) {
    let msg = 'API Error: ' + res.status;
    try {
      const err = await res.json();
      if (err && err.error) msg = err.error;
    } catch (e) {}
    throw new HttpError(res.status, msg);
  }
  return await res.json();
}
