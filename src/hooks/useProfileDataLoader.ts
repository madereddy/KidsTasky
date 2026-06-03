import { useCallback } from 'react';
import { categoryService } from '../services/categories';
import { settingsClientService } from '../services/settings';
import { userService } from '../services/users';
import { Category, UserProfile } from '../types';

interface UseProfileDataLoaderOptions {
  kidsRef: React.MutableRefObject<UserProfile[]>;
  initSocket: (parentId: string) => void;
  setCategories: (categories: Category[]) => void;
  setKids: (kids: UserProfile[]) => void;
  setIsLocked: (locked: boolean) => void;
  setSleepStart: (value: string | undefined) => void;
  setSleepEnd: (value: string | undefined) => void;
  setScreensaverShuffle: (value: boolean) => void;
  setScreensaverDurationSec: (value: number) => void;
  setScreensaverCaptions: (value: boolean) => void;
}

export function useProfileDataLoader({
  kidsRef,
  initSocket,
  setCategories,
  setKids,
  setIsLocked,
  setSleepStart,
  setSleepEnd,
  setScreensaverShuffle,
  setScreensaverDurationSec,
  setScreensaverCaptions,
}: UseProfileDataLoaderOptions) {
  const loadProfileData = useCallback(async (profile: UserProfile, options?: { fastKidSwitch?: boolean }) => {
    const parentId = profile.parentId || profile.uid;
    if (!parentId) return;

    initSocket(parentId);
    const [cats, familyKids, settings] = await Promise.all([
      categoryService.getCategories(parentId).catch(() => []),
      options?.fastKidSwitch && profile.role === 'kid'
        ? Promise.resolve(kidsRef.current)
        : userService.getKidsForParent(parentId).catch(() => []),
      profile.role === 'parent'
        ? settingsClientService.getSettings(parentId).catch(() => null)
        : Promise.resolve(null),
    ]);

    setCategories(cats || []);
    if (familyKids && familyKids.length > 0) setKids(familyKids || []);

    if (profile.role === 'parent' && settings) {
      setIsLocked(Boolean(settings.isLocked));
      setSleepStart(settings.sleepStart);
      setSleepEnd(settings.sleepEnd);
      if (settings.screensaverShuffle !== undefined) setScreensaverShuffle(Boolean(settings.screensaverShuffle));
      if (settings.screensaverDurationSec) setScreensaverDurationSec(settings.screensaverDurationSec);
      if (settings.screensaverCaptions !== undefined) setScreensaverCaptions(settings.screensaverCaptions !== false);
    } else {
      setIsLocked(false);
    }
    return settings;
  }, [
    initSocket,
    kidsRef,
    setCategories,
    setIsLocked,
    setKids,
    setScreensaverCaptions,
    setScreensaverDurationSec,
    setScreensaverShuffle,
    setSleepEnd,
    setSleepStart,
  ]);

  return { loadProfileData };
}
