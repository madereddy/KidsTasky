import { useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/auth';
import { userService } from '../services/users';
import { categoryService } from '../services/categories';
import { clientLogger } from '../services/clientLogger';
import { UserProfile, Category, AppUser } from '../types';
import { initSocket, useSocketStaleData } from './useSocket';
import { useProfileDataLoader } from './useProfileDataLoader';

const PARENT_SESSION_KEY = 'kidtasker_parent_session';

const isParentRole = (role?: UserProfile['role']) => role === 'parent' || role === 'coparent';

export function useAppInitialization() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familySettings, setFamilySettings] = useState<any>(null);
  const [parentSession, setParentSession] = useState<{ token: string; user: AppUser; profile: UserProfile } | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false);
  const [kids, setKids] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLocked, setIsLocked] = useState(() => ['/wall', '/kiosk'].includes(window.location.pathname));
  const [sleepStart, setSleepStart] = useState<string | undefined>();
  const [sleepEnd, setSleepEnd] = useState<string | undefined>();
  const [screensaverShuffle, setScreensaverShuffle] = useState(false);
  const [screensaverDurationSec, setScreensaverDurationSec] = useState(10);
  const [screensaverCaptions, setScreensaverCaptions] = useState(true);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');

  const kidsRef = useRef<UserProfile[]>([]);
  useEffect(() => { kidsRef.current = kids; }, [kids]);

  const persistParentSession = useCallback((session: { token: string; user: AppUser; profile: UserProfile } | null) => {
    setParentSession(session);
    if (!session) {
      sessionStorage.removeItem(PARENT_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(PARENT_SESSION_KEY, JSON.stringify(session));
  }, []);

  const { loadProfileData } = useProfileDataLoader({
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
    setTimeFormat,
  });

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('kidtasker_token');
      const rawParentSession = sessionStorage.getItem(PARENT_SESSION_KEY);
      if (rawParentSession) {
        try { setParentSession(JSON.parse(rawParentSession)); } catch {}
      }
      if (storedToken) {
        try {
          const u = await authService.getMe(storedToken);
          if (u) {
            setUser({ uid: u.uid, name: u.name, email: u.email });
            setProfile(u);
            if (u.role === 'kid') {
              void loadProfileData(u, { fastKidSwitch: true }).then(setFamilySettings);
            } else {
              const settings = await loadProfileData(u);
              setFamilySettings(settings);
            }
            if (isParentRole(u.role)) {
              persistParentSession({ token: storedToken, user: { uid: u.uid, name: u.name, email: u.email }, profile: u });
            }
          } else {
            localStorage.removeItem('kidtasker_token');
          }
        } catch (e) {
          clientLogger.errorWithException('auth_initialization_failed', e);
          setInitError(true);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [loadProfileData, persistParentSession]);

  const refreshCategories = useCallback(async () => {
    if (!profile) return;
    const parentId = profile.parentId || profile.uid;
    if (parentId) {
      const cats = await categoryService.getCategories(parentId);
      setCategories(cats || []);
    }
  }, [profile]);

  const refreshKids = useCallback(async () => {
    if (!profile || !isParentRole(profile.role)) return;
    const parentId = profile.parentId || profile.uid;
    if (!parentId) return;
    const nextKids = await userService.getKidsForParent(parentId);
    if (nextKids && JSON.stringify(nextKids) !== JSON.stringify(kidsRef.current)) {
      setKids(nextKids);
    }
  }, [profile]);

  useSocketStaleData(['categories', 'users', 'kids'], useCallback((data: { entity?: string; type?: string }) => {
    const signal = data.type || data.entity;
    if (signal === 'categories') {
      refreshCategories();
      return;
    }
    if (signal === 'users' || signal === 'kids') {
      refreshKids();
    }
  }, [refreshCategories, refreshKids]));

  return {
    user, setUser,
    profile, setProfile,
    familySettings, setFamilySettings,
    parentSession, setParentSession,
    loading, setLoading,
    initError, setInitError,
    kids, setKids,
    categories, setCategories,
    isLocked, setIsLocked,
    sleepStart, sleepEnd,
    screensaverShuffle, screensaverDurationSec, screensaverCaptions,
    timeFormat, setTimeFormat,
    persistParentSession,
    loadProfileData,
    refreshKids,
    refreshCategories
  };
}
