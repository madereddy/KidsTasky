import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteService } from './invites';

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

describe('inviteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('createInvite sends correct request with default type', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'invite123' })
    });

    const res = await inviteService.createInvite('p1', 'Parent');
    expect(res).toBe('invite123');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/invites'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ parentId: 'p1', parentName: 'Parent', type: 'kid' })
    }));
  });

  it('createCoParentInvite sends correct request', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'invite123' })
    });

    const res = await inviteService.createCoParentInvite('p1', 'Parent');
    expect(res).toBe('invite123');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/invites'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ parentId: 'p1', parentName: 'Parent', type: 'coparent' })
    }));
  });

  it('getActiveInvite sends correct request', async () => {
    const mockInvite = { id: 'i1', code: 'ABC' };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockInvite
    });

    const res = await inviteService.getActiveInvite('p1');
    expect(res).toEqual(mockInvite);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/parents/p1/invites/active'), expect.any(Object));
  });

  it('getActiveCoParentInvite sends correct request', async () => {
    const mockInvite = { id: 'i1', code: 'ABC' };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockInvite
    });

    const res = await inviteService.getActiveCoParentInvite('p1');
    expect(res).toEqual(mockInvite);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/parents/p1/invites/coparent/active'), expect.any(Object));
  });

  it('validateInvite sends correct request', async () => {
    const mockInvite = { id: 'i1', code: 'ABC' };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockInvite
    });

    const res = await inviteService.validateInvite('ABC');
    expect(res).toEqual(mockInvite);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/invites/ABC/validate'), expect.any(Object));
  });
});
