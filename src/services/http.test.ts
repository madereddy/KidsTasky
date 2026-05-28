import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAPI } from './http';

describe('fetchAPI retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('kidtasker_token', 'tkn');
  });

  it('retries on 429 then succeeds', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0' }),
        json: async () => ({ error: 'rate limited' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      } as any);

    const result = await fetchAPI('/health');
    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
