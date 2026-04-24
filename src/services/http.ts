export const API_BASE = '/api';

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(API_BASE + endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options
  });
  if (!res.ok) {
    let msg = 'API Error: ' + res.status;
    try {
      const err = await res.json();
      if (err && err.error) msg = err.error;
    } catch (e) {}
    throw new Error(msg);
  }
  return await res.json();
}
