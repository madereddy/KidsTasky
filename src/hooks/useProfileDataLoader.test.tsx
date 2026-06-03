// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileDataLoader } from './useProfileDataLoader';

vi.mock('../services/categories', () => ({
  categoryService: {
    getCategories: vi.fn(),
  },
}));

vi.mock('../services/users', () => ({
  userService: {
    getKidsForParent: vi.fn(),
  },
}));

vi.mock('../services/settings', () => ({
  settingsClientService: {
    getSettings: vi.fn(),
  },
}));

import { categoryService } from '../services/categories';
import { userService } from '../services/users';
import { settingsClientService } from '../services/settings';

describe('useProfileDataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoryService.getCategories).mockResolvedValue([] as any);
    vi.mocked(userService.getKidsForParent).mockResolvedValue([] as any);
    vi.mocked(settingsClientService.getSettings).mockResolvedValue(null as any);
  });

  it('uses cached kids during a fast kid switch', async () => {
    const kidsRef = { current: [{ uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com' }] } as any;
    const setKids = vi.fn();

    const { result } = renderHook(() => useProfileDataLoader({
      kidsRef,
      initSocket: vi.fn(),
      setCategories: vi.fn(),
      setKids,
      setIsLocked: vi.fn(),
      setSleepStart: vi.fn(),
      setSleepEnd: vi.fn(),
      setScreensaverShuffle: vi.fn(),
      setScreensaverDurationSec: vi.fn(),
      setScreensaverCaptions: vi.fn(),
    }));

    await result.current.loadProfileData(
      { uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com', parentId: 'p1' },
      { fastKidSwitch: true },
    );

    expect(userService.getKidsForParent).not.toHaveBeenCalled();
    expect(setKids).toHaveBeenCalledWith(kidsRef.current);
  });

  it('loads parent settings and lock state for a parent profile', async () => {
    const setIsLocked = vi.fn();
    const setSleepStart = vi.fn();
    const setSleepEnd = vi.fn();
    const setScreensaverShuffle = vi.fn();
    const setScreensaverDurationSec = vi.fn();
    const setScreensaverCaptions = vi.fn();
    vi.mocked(userService.getKidsForParent).mockResolvedValue([{ uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com' }] as any);
    vi.mocked(settingsClientService.getSettings).mockResolvedValue({
      isLocked: true,
      sleepStart: '21:00',
      sleepEnd: '07:00',
      screensaverShuffle: true,
      screensaverDurationSec: 15,
      screensaverCaptions: false,
    } as any);

    const { result } = renderHook(() => useProfileDataLoader({
      kidsRef: { current: [] } as any,
      initSocket: vi.fn(),
      setCategories: vi.fn(),
      setKids: vi.fn(),
      setIsLocked,
      setSleepStart,
      setSleepEnd,
      setScreensaverShuffle,
      setScreensaverDurationSec,
      setScreensaverCaptions,
    }));

    await result.current.loadProfileData({ uid: 'p1', role: 'parent', name: 'Parent', email: 'parent@test.com' });

    expect(settingsClientService.getSettings).toHaveBeenCalledWith('p1');
    expect(setIsLocked).toHaveBeenCalledWith(true);
    expect(setSleepStart).toHaveBeenCalledWith('21:00');
    expect(setSleepEnd).toHaveBeenCalledWith('07:00');
    expect(setScreensaverShuffle).toHaveBeenCalledWith(true);
    expect(setScreensaverDurationSec).toHaveBeenCalledWith(15);
    expect(setScreensaverCaptions).toHaveBeenCalledWith(false);
  });
});
