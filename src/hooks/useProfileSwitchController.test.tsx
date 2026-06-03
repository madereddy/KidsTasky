// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileSwitchController } from './useProfileSwitchController';

vi.mock('../services/auth', () => ({
  authService: {
    signInKid: vi.fn(),
    getMe: vi.fn(),
  },
}));

vi.mock('../services/settings', () => ({
  settingsClientService: {
    unlockDisplay: vi.fn(),
  },
}));

import { authService } from '../services/auth';
import { settingsClientService } from '../services/settings';

describe('useProfileSwitchController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('kidtasker_token', 'parent-token');
  });

  it('switches from parent to kid and persists the parent session', async () => {
    const persistParentSession = vi.fn();
    const loadProfileData = vi.fn().mockResolvedValue(undefined);
    const warmProfile = vi.fn();
    const setUser = vi.fn();
    const setProfile = vi.fn();
    const setIsLocked = vi.fn();
    vi.mocked(authService.signInKid).mockResolvedValue({
      token: 'kid-token',
      user: { uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com' },
    } as any);

    const { result } = renderHook(() => useProfileSwitchController({
      profile: { uid: 'p1', role: 'parent', name: 'Parent', email: 'parent@test.com' },
      user: { uid: 'p1', name: 'Parent', email: 'parent@test.com' },
      parentSession: null,
      persistParentSession,
      loadProfileData,
      warmProfile,
      setUser,
      setProfile,
      setIsLocked,
    }));

    await act(async () => {
      await result.current.switchToKidProfile({ uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com' } as any, '1234');
    });

    expect(persistParentSession).toHaveBeenCalledWith({
      token: 'parent-token',
      user: { uid: 'p1', name: 'Parent', email: 'parent@test.com' },
      profile: { uid: 'p1', role: 'parent', name: 'Parent', email: 'parent@test.com' },
    });
    expect(loadProfileData).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'k1', role: 'kid' }),
      { fastKidSwitch: true },
    );
    expect(localStorage.getItem('kidtasker_token')).toBe('kid-token');
  });

  it('switches from kid back to parent and unlocks the display', async () => {
    const loadProfileData = vi.fn().mockResolvedValue(undefined);
    const warmProfile = vi.fn();
    const setUser = vi.fn();
    const setProfile = vi.fn();
    const setIsLocked = vi.fn();
    vi.mocked(settingsClientService.unlockDisplay).mockResolvedValue({ success: true } as any);
    vi.mocked(authService.getMe).mockResolvedValue({ uid: 'p1', role: 'parent', name: 'Parent', email: 'parent@test.com' } as any);

    const { result } = renderHook(() => useProfileSwitchController({
      profile: { uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com', parentId: 'p1' },
      user: { uid: 'k1', name: 'Kid One', email: 'kid@test.com' },
      parentSession: {
        token: 'parent-token',
        user: { uid: 'p1', name: 'Parent', email: 'parent@test.com' },
        profile: { uid: 'p1', role: 'parent', name: 'Parent', email: 'parent@test.com' },
      },
      persistParentSession: vi.fn(),
      loadProfileData,
      warmProfile,
      setUser,
      setProfile,
      setIsLocked,
    }));

    await act(async () => {
      await result.current.switchToParentProfile('2468');
    });

    expect(settingsClientService.unlockDisplay).toHaveBeenCalledWith('p1', '2468');
    expect(loadProfileData).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'p1', role: 'parent' }),
    );
    expect(setIsLocked).toHaveBeenCalledWith(false);
    expect(localStorage.getItem('kidtasker_token')).toBe('parent-token');
  });
});
