import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from './users';

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

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('getCoParents sends correct request', async () => {
    const mockCoParents = [{ uid: 'cp1', name: 'CoParent' }];
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockCoParents
    });

    const res = await userService.getCoParents('p1');
    expect(res).toEqual(mockCoParents);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/parents/p1/coparents'), expect.any(Object));
  });

  it('removeCoParent sends correct request', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    await userService.removeCoParent('cp1');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/users/cp1/coparent'), expect.objectContaining({
      method: 'DELETE'
    }));
  });

  it('getKidsForParent sends correct request', async () => {
    const mockKids = [{ uid: 'k1', name: 'Kid' }];
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockKids
    });

    const res = await userService.getKidsForParent('p1');
    expect(res).toEqual(mockKids);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/parents/p1/kids'), expect.any(Object));
  });
});
