import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './auth';

global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('signInKid sends correct request', async () => {
    const mockRes = { user: { uid: 'kid1', name: 'Kid' }, token: 'tk' };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockRes
    });

    const res = await authService.signInKid('kid1', '1234');
    expect(res).toEqual(mockRes);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/login/kid'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ uid: 'kid1', pin: '1234' })
    }));
  });

  it('getProfilesByEmail fetches profiles', async () => {
    const mockKids = [{ uid: 'k1', name: 'K' }];
    (fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ kids: mockKids })
    });

    const res = await authService.getProfilesByEmail('test@e.com');
    expect(res).toEqual(mockKids);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/profiles/test%40e.com'), expect.any(Object));
  });

  it('setPin calls backend with token', async () => {
    localStorage.setItem('kidtasker_token', 'my_token');
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    const res = await authService.setPin('4321');
    expect(res).toBe(true);
    
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/auth/set-pin');
    expect(options.method).toBe('POST');
    expect(options.headers.get('Authorization')).toBe('Bearer my_token');
    expect(options.body).toBe(JSON.stringify({ pin: '4321' }));
  });
});
