import { fetchAPI } from './services/http';
import { getOfflineQueue, popOfflineAction } from './lib/offline-queue';
import { authService } from './services/auth';
import { userService } from './services/users';
import { categoryService } from './services/categories';
import { settingsClientService } from './services/settings';
import { tasksClientService } from './services/tasks';
import { eventsClientService } from './services/events';
import { homeworkClientService } from './services/homework';
import { listsClientService } from './services/lists';
import { mealsClientService } from './services/meals';
import { subscribeToPush, unsubscribeFromPush } from './services/push';
import { clientLogger } from './services/clientLogger';
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense, startTransition } from 'react';
import { LogOut, Rocket, User as UserIcon, Activity, CalendarDays, List, UtensilsCrossed, Settings, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Category, MissionItem } from './types';
import { cn } from './lib/utils';
import { THEMES, MEMBER_COLORS } from './constants';
import { initSocket, useSocketStaleData } from './hooks/useSocket';
import { useSleepMode } from './hooks/useSleepMode';
import { useProfileSwitchController } from './hooks/useProfileSwitchController';
import { useProfileDataLoader } from './hooks/useProfileDataLoader';
import { DisplayContext } from './contexts/DisplayContext';
import { FamilyDataContext } from './contexts/FamilyDataContext';

import { ShareTargetHandler } from './components/shared/ShareTargetHandler';
import { ParentalLockOverlay } from './components/shared/ParentalLockOverlay';
import { SleepModeOverlay } from './components/shared/SleepModeOverlay';
import { PhotoScreensaver } from './components/shared/PhotoScreensaver';
import { LoginView } from './components/auth/LoginView';
import { OnboardingView } from './components/onboarding/OnboardingView';
import { WallHome } from './components/parent/WallHome';
import { KidDashboard } from './components/kid/KidDashboard';
import { Skeleton, WallSkeleton } from './components/shared/Skeleton';
import { SectionSkeleton } from './components/shared/SectionSkeleton';
import { MissionTodayView } from './components/shared/MissionTodayView';
import { ActionBolt } from './components/shared/ActionBolt';
import { BottomNav } from './components/shared/BottomNav';
import { ToolsMenu } from './components/shared/ToolsMenu';
import { useWallHomeController } from './hooks/useWallHomeController';
import { useListsController } from './hooks/useListsController';
import { format } from 'date-fns';

const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string
) => lazy(async () => {
  // Yield one macrotask so React can commit the Suspense fallback and wire the
  // retry-ping listener BEFORE this promise resolves.  Without this, a pre-cached
  // import resolves in the same microtask queue flush as the Suspense setup,
  // causing the ping to fire before the retry listener exists → stuck forever.
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  const retryKey = `kidtasker:lazy-retry:${key}`;
  try {
    const mod = await importer();
    sessionStorage.removeItem(retryKey);
    return mod;
  } catch (error) {
    // Stale chunk after a deploy: hard-reload once to fetch the new manifest.
    if (sessionStorage.getItem(retryKey) !== '1') {
      sessionStorage.setItem(retryKey, '1');
      window.location.reload();
    }
    throw error;
  }
});

const ParentDashboard = lazyWithRetry(() => import('./components/parent/ParentDashboard').then(m => ({ default: m.ParentDashboard })), 'parent-dashboard');
const ParentTasksWorkspace = lazyWithRetry(() => import('./components/parent/ParentTasksWorkspace').then(m => ({ default: m.ParentTasksWorkspace })), 'parent-tasks');
const CalendarView = lazyWithRetry(() => import('./components/calendar/CalendarView').then(m => ({ default: m.CalendarView })), 'calendar');
const ShoppingView = lazyWithRetry(() => import('./components/lists/ShoppingView').then(m => ({ default: m.ShoppingView })), 'shopping');
const RoutinesView = lazyWithRetry(() => import('./components/lists/RoutinesView').then(m => ({ default: m.RoutinesView })), 'routines');
const MealPlanView = lazyWithRetry(() => import('./components/parent/MealPlanView').then(m => ({ default: m.MealPlanView })), 'meals');
const SettingsView = lazyWithRetry(() => import('./components/parent/SettingsView').then(m => ({ default: m.SettingsView })), 'settings');

interface AppUser {
  uid: string;
  email?: string;
  name: string;
  displayName?: string;
}

const PARENT_SESSION_KEY = 'kidtasker_parent_session';
const KID_IDLE_RETURN_MS = 5 * 60 * 1000;

const prefetchParentTasks = () => { import('./components/parent/ParentTasksWorkspace'); };
const prefetchCalendar = () => { import('./components/calendar/CalendarView'); };
const prefetchShopping = () => { import('./components/lists/ShoppingView'); };
const prefetchRoutines = () => { import('./components/lists/RoutinesView'); };
const prefetchMeals = () => { import('./components/parent/MealPlanView'); };
const prefetchSettings = () => { import('./components/parent/SettingsView'); };

function runIdle(task: () => void) {
  const anyWindow = window as any;
  if (typeof anyWindow.requestIdleCallback === 'function') {
    anyWindow.requestIdleCallback(() => task(), { timeout: 2000 });
    return;
  }
  setTimeout(task, 0);
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familySettings, setFamilySettings] = useState<any>(null);
  const [parentSession, setParentSession] = useState<{ token: string; user: AppUser; profile: UserProfile } | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'home' | 'tasks' | 'calendar' | 'shopping' | 'routines' | 'meals' | 'manage' | string>('home');
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [hiddenMissionIds, setHiddenMissionIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('kidtasker_hidden_missions');
    const today = format(new Date(), 'yyyy-MM-dd');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === today && Array.isArray(parsed.ids)) {
          return new Set(parsed.ids);
        }
      } catch (e) {
        // ignore parse error
      }
    }
    return new Set();
  });

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    localStorage.setItem('kidtasker_hidden_missions', JSON.stringify({
      date: today,
      ids: Array.from(hiddenMissionIds)
    }));
  }, [hiddenMissionIds]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleResize = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  // Separate counter used only to force a re-render after lazy chunks resolve.
  // Pre-cached chunks can miss React's Suspense retry ping (the ping fires before
  // React commits the fallback and wires the retry listener). A re-render ~50ms
  // after the section switch re-reconciles the Suspense boundary, which by then
  // has the lazy module cached, so it commits the component without throwing.
  const [, setNavRetryTick] = useState(0);
  const goToSection = useCallback((section: 'home' | 'tasks' | 'calendar' | 'shopping' | 'routines' | 'meals' | 'manage') => {
    // Commit the section change immediately so the fallback UI can render even
    // when the destination chunk is still loading.
    setActiveSection(section);
    setTimeout(() => setNavRetryTick(t => t + 1), 50);
  }, []);
  const [kids, setKids] = useState<UserProfile[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [sleepStart, setSleepStart] = useState<string | undefined>(undefined);
  const [sleepEnd, setSleepEnd] = useState<string | undefined>(undefined);
  const [screensaverShuffle, setScreensaverShuffle] = useState(false);
  const [screensaverDurationSec, setScreensaverDurationSec] = useState(10);
  const [screensaverCaptions, setScreensaverCaptions] = useState(true);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const { isSleeping: isSleepScheduled } = useSleepMode({ sleepStart, sleepEnd });
  const [sleepDismissed, setSleepDismissed] = useState(false);
  const isSleepMode = isSleepScheduled && !sleepDismissed;
  useEffect(() => { if (!isSleepScheduled) setSleepDismissed(false); }, [isSleepScheduled]);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [initError, setInitError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [screensaverPreview, setScreensaverPreview] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const flushQueue = useCallback(async () => {
    if (syncing || isOffline) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setSyncing(true);
    try {
      while (getOfflineQueue().length > 0) {
        const action = popOfflineAction();
        if (!action) break;
        try {
          await fetchAPI(action.endpoint, {
            method: action.method,
            body: action.body,
            skipQueue: true
          }, 0); 
        } catch (e: any) {
          if (e.status === 0) {
            // Re-queue at the front if it's a network error during sync
            const currentQueue = getOfflineQueue();
            localStorage.setItem('kidtasker_offline_queue', JSON.stringify([action, ...currentQueue]));
            break; // Stop flushing if network is still failing
          }
          console.warn('Sync conflict or error, skipping action:', action.description, e);
        }
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, isOffline]);

  useEffect(() => {
    if (!isOffline) {
      void flushQueue();
    }
  }, [isOffline, flushQueue]);

  const kidsRef = useRef<UserProfile[]>([]);

  useEffect(() => {
    kidsRef.current = kids;
  }, [kids]);

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

  const warmProfile = useCallback((u: UserProfile) => {
    const parentId = u.parentId || u.uid;
    if (!parentId) return;
    runIdle(() => {
      prefetchParentTasks();
      prefetchCalendar();
      prefetchShopping();
      prefetchRoutines();
      prefetchMeals();
      prefetchSettings();
      if (u.role === 'parent') {
        void Promise.allSettled([
          tasksClientService.getTasksForParent(parentId),
          eventsClientService.getEvents(parentId),
          homeworkClientService.getHomework(parentId),
          listsClientService.getLists(parentId),
          mealsClientService.getRecipes(parentId),
        ]);
      } else {
        void Promise.allSettled([
          tasksClientService.getTasksForKid(u.uid),
          eventsClientService.getEvents(parentId),
          homeworkClientService.getHomework(parentId),
        ]);
      }
    });
  }, []);

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
            if (u.role === 'parent') {
              persistParentSession({ token: storedToken, user: { uid: u.uid, name: u.name, email: u.email }, profile: u });
            }
            warmProfile(u);
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
  }, [loadProfileData, persistParentSession, warmProfile]);

  useEffect(() => {
    const handleShare = () => {
      goToSection('manage');
    };
    window.addEventListener('kidtasker:share', handleShare);
    return () => window.removeEventListener('kidtasker:share', handleShare);
  }, [goToSection]);

  const handleLogout = async () => {
    await unsubscribeFromPush().catch((error) => {
      clientLogger.warn('push_unsubscribe_failed', { error });
    });
    localStorage.removeItem('kidtasker_token');
    persistParentSession(null);
    setUser(null);
    setProfile(null);
  };

  const {
    showProfileSwitcher,
    setShowProfileSwitcher,
    pendingKidSwitch,
    setPendingKidSwitch,
    kidSwitchPin,
    setKidSwitchPin,
    showParentSwitchPin,
    setShowParentSwitchPin,
    parentSwitchPin,
    setParentSwitchPin,
    switchError,
    setSwitchError,
    switchingProfileLabel,
    setSwitchingProfileLabel,
    switchToKidProfile,
    switchToParentProfile,
  } = useProfileSwitchController({
    profile,
    user,
    parentSession,
    persistParentSession,
    loadProfileData,
    warmProfile,
    setUser: (next) => setUser(next),
    setProfile: (next) => setProfile(next),
    setIsLocked,
  });


  const refreshCategories = useCallback(async () => {
    if (!profile) return;
    const parentId = profile.parentId || profile.uid;
    if (parentId) {
      const cats = await categoryService.getCategories(parentId);
      setCategories(cats || []);
    }
  }, [profile]);

  const refreshKids = useCallback(async () => {
    if (!profile || profile.role !== 'parent') return;
    const parentId = profile.parentId || profile.uid;
    if (!parentId) return;
    const nextKids = await userService.getKidsForParent(parentId);
    if (nextKids && JSON.stringify(nextKids) !== JSON.stringify(kidsRef.current)) {
      clientLogger.info('app_refresh_kids_updated', { count: nextKids.length });
      setKids(nextKids);
    } else {
      clientLogger.info('app_refresh_kids_unchanged', { count: kidsRef.current.length });
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

  // Proactive token refresh — re-issue token 30 min before expiry so kiosk never goes stale
  useEffect(() => {
    if (!user) return;
    function scheduleRefresh() {
      const token = localStorage.getItem('kidtasker_token');
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresMs = payload.exp * 1000;
        const msUntilRefresh = expiresMs - Date.now() - 30 * 60 * 1000; // 30 min buffer
        const delay = Math.max(msUntilRefresh, 0);
        return setTimeout(async () => {
          const newToken = await authService.refresh();
          if (newToken) {
            localStorage.setItem('kidtasker_token', newToken);
            scheduleRefresh(); // schedule next refresh
          }
        }, delay);
      } catch {
        return undefined;
      }
    }
    const timer = scheduleRefresh();
    return () => { if (timer) clearTimeout(timer); };
  }, [user]);

  useEffect(() => {
    if (!profile || profile.role !== 'kid' || !parentSession) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const parent = parentSession.profile;
          const parentId = parent.parentId || parent.uid;
          localStorage.setItem('kidtasker_token', parentSession.token);
          const refreshed = await authService.getMe(parentSession.token);
          const next = refreshed && refreshed.role === 'parent' ? refreshed : parent;
          setUser({ uid: next.uid, name: next.name, email: next.email });
          setProfile(next);
          setActiveSection('home');
          await loadProfileData(next);
          if (parentId) {
            await settingsClientService.lockDisplay(parentId).catch(() => {});
            setIsLocked(true);
          }
        } catch {
          // keep kid session if switch-back fails
        }
      }, KID_IDLE_RETURN_MS);
    };
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('touchstart', resetIdle);
    resetIdle();
    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
      clearTimeout(timer);
    };
  }, [loadProfileData, parentSession, profile]);

  const handleProfileUpdate = async () => {
    if (user) {
      const p = await userService.getUserProfile(user.uid);
      setProfile(p);
    }
  };

  const memberColorMap = useMemo(() => {
    if (!profile) return {};
    return [profile, ...kids].reduce((acc, u) => {
      acc[u.uid] = u.color ?? MEMBER_COLORS[0];
      return acc;
    }, {} as Record<string, string>);
  }, [profile, kids]);

  const currentThemeId = profile?.themeId || 'space_commander';
  const currentTheme = THEMES.find(t => t.id === currentThemeId) || THEMES[0];
  const isDarkTheme = !!currentTheme.vocab?.darkMode;
  const familyParentId = profile?.parentId || profile?.uid || '';

  const {
    allTasks,
    allCompletions,
    events,
    fetchFamilyData: refreshWallData,
    lists: globalLists,
    listItems: globalListItems
  } = useWallHomeController({ 
    parentId: familyParentId, 
    kids, 
    initialSettings: familySettings 
  });

  useSocketStaleData(['tasks', 'completions', 'lists', 'list_items'], useCallback(() => {
    refreshWallData();
  }, [refreshWallData]));

  const {
    items: selectedListItems,
    lists: sidebarLists,
    toggleItem: toggleListItem
  } = useListsController({ 
    parentId: familyParentId 
  });

  const handleMissionAction = useCallback(async (item: MissionItem, action: 'complete' | 'dismiss') => {
    if (!profile) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Optimistic UI: Hide immediately
    setHiddenMissionIds(prev => new Set([...prev, item.id]));

    if (action === 'complete') {
      if (item.type === 'task') {
        const kidId = item.assignedToId || profile.uid;
        await tasksClientService.completeTask(item.originalData.id, kidId, today);
      } else if (item.type === 'list_item') {
        await toggleListItem(item.originalData.id, true);
      } else if (item.type === 'routine') {
        // Bulk-complete all uncompleted items in this routine
        const routineItems = globalListItems.filter(li => li.listId === item.originalData.id && li.completed === 0);
        await Promise.all(routineItems.map(li => toggleListItem(li.id, true)));
      }
      refreshWallData();
    } else if (action === 'dismiss') {
      if (item.type === 'task') {
        const kidId = item.assignedToId || profile.uid;
        await tasksClientService.skipTask(item.originalData.id, kidId, today);
      }
      refreshWallData();
    }
  }, [profile, refreshWallData, toggleListItem]);

  useEffect(() => {
    if (!profile || profile.role !== 'parent' || isLocked) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsLocked(true), 10 * 60 * 1000);
    };
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);
    window.addEventListener("touchstart", resetIdle);
    resetIdle();
    return () => {
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("touchstart", resetIdle);
      clearTimeout(timer);
    };
  }, [profile, isLocked]);

  const visibleTasks = useMemo(() => allTasks.filter(t => !hiddenMissionIds.has(`task_${t.id}`)), [allTasks, hiddenMissionIds]);
  const visibleEvents = useMemo(() => events.filter(e => !hiddenMissionIds.has(`event_${e.id}`)), [events, hiddenMissionIds]);
  const visibleListItems = useMemo(() => globalListItems.filter(l => !hiddenMissionIds.has(`list_${l.id}`)), [globalListItems, hiddenMissionIds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ui-soft p-6">
        <div className="max-w-7xl mx-auto">
          <header className="h-16 mb-8 rounded-[2rem] bg-white/80 border border-ui flex items-center px-6 justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="w-32 h-6" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </header>
          <WallSkeleton />
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-ui-soft flex items-center justify-center flex-col gap-4">
        <p className="text-ui-muted font-medium">Failed to connect to server</p>
        <button
          onClick={() => { setInitError(false); setLoading(true); window.location.reload(); }}
          className="px-6 py-3 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-ui-soft text-ui-primary selection:bg-sky-500/30 overflow-x-hidden">
        <LoginView 
          onLogin={async (email: string, passwordString: string, isRegister: boolean, name?: string) => {
            const res = isRegister ? await authService.register(email, passwordString, name || '') : await authService.signIn(email, passwordString);
            if (res) {
              const { user: u, token } = res;
              setUser({ uid: u.uid, name: u.name, email: u.email });
              localStorage.setItem('kidtasker_token', token);
              if (u.role) {
                setProfile(u);
                if (u.role === 'kid') {
                  void loadProfileData(u, { fastKidSwitch: true });
                } else {
                  await loadProfileData(u);
                }
                if (u.role === 'parent') {
                  persistParentSession({ token, user: { uid: u.uid, name: u.name, email: u.email }, profile: u });
                }
                warmProfile(u);
              }
              subscribeToPush().catch((error) => {
                clientLogger.warn('push_subscribe_failed_after_parent_login', { error });
              });
            } else {
              alert('Invalid credentials or registration error');
            }
          }} 
          onKidLogin={async (uid: string, pin: string) => {
            const res = await authService.signInKid(uid, pin);
            if (res) {
              const { user: u, token } = res;
              setUser({ uid: u.uid, name: u.name, email: u.email });
              localStorage.setItem('kidtasker_token', token);
              if (u.role) {
                setProfile(u);
                void loadProfileData(u, { fastKidSwitch: true });
                warmProfile(u);
              }
              subscribeToPush().catch((error) => {
                clientLogger.warn('push_subscribe_failed_after_kid_login', { error });
              });
            } else {
              alert('Invalid Access Key');
            }
          }}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-ui-soft text-ui-primary selection:bg-sky-500/30">
        <OnboardingView 
          user={{ uid: user.uid, email: user.email, name: user.name }} 
          onComplete={async (p: UserProfile) => {
            setProfile(p);
            await loadProfileData(p);
            warmProfile(p);
            subscribeToPush().catch((error) => {
              clientLogger.warn('push_subscribe_failed_after_onboarding', { error });
            });
          }} 
        />
      </div>
    );
  }

  return (
    <FamilyDataContext.Provider value={{ kids, categories, memberColorMap, refreshKids, refreshCategories }}>
    <DisplayContext.Provider value={{ isWallMode: isLocked, isSleepMode }}>
    <ShareTargetHandler />
    <SleepModeOverlay isActive={isSleepMode} use24h={timeFormat === '24h'} onDismiss={() => setSleepDismissed(true)} />
    <div className={cn("min-h-screen selection:bg-sky-500/30 [overflow-x:clip] pb-12 transition-colors duration-500", currentTheme.vocab?.darkMode ? "text-white theme-dark" : "text-ui-primary theme-light", isLocked && "wall-mode")} style={{ background: currentTheme.bg }}>
      <header className={cn("sticky top-0 z-[60] backdrop-blur-xl border-b mx-4 mt-4 rounded-[2rem] px-6 py-3 mb-8 shadow-sm", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-ui")}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl bg-gradient-to-br", `from-${currentTheme.primary} to-${currentTheme.accent}`, "shadow-sm")}>
                <Rocket className={cn("w-6 h-6", currentTheme.vocab?.darkMode ? "text-white" : "text-white")} />
              </div>
              <h1 className={cn("text-xl font-bold tracking-tight hidden sm:block", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                {profile.role === 'parent' ? 'Family Hub' : currentTheme.vocab?.hub || 'My Chores'}
              </h1>
              {isOffline && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full animate-pulse ml-2 whitespace-nowrap">
                  <span>☁️ Offline</span>
                </div>
              )}
              {syncing && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full ml-2 whitespace-nowrap">
                  <Activity className="w-3 h-3 animate-spin" />
                  <span>Syncing...</span>
                </div>
              )}
            </div>
            
            <div className="h-8 w-[1px] bg-ui-soft-3 hidden sm:block" />

            {profile?.role === 'parent' && (
              <nav className={cn("hidden md:flex gap-1 p-1 rounded-2xl", isDarkTheme ? "bg-ui-dark-50" : "bg-ui-soft-2")}>
                <button
                  onClick={() => goToSection('home')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                    activeSection === 'home' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  Home
                </button>
                <button
                  onClick={() => goToSection('tasks')}
                  onMouseEnter={prefetchParentTasks}
                  onFocus={prefetchParentTasks}
                  onTouchStart={prefetchParentTasks}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                    activeSection === 'tasks' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  Tasks
                </button>
                <button
                  onClick={() => goToSection('calendar')}
                  onMouseEnter={prefetchCalendar}
                  onFocus={prefetchCalendar}
                  onTouchStart={prefetchCalendar}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'calendar' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  <CalendarDays className="w-4 h-4" /> Calendar
                </button>
                <button
                  onClick={() => goToSection('shopping')}
                  onMouseEnter={prefetchShopping}
                  onFocus={prefetchShopping}
                  onTouchStart={prefetchShopping}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'shopping' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  <List className="w-4 h-4" /> Shopping
                </button>
                <button
                  onClick={() => goToSection('routines')}
                  onMouseEnter={prefetchRoutines}
                  onFocus={prefetchRoutines}
                  onTouchStart={prefetchRoutines}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'routines' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  <Rocket className="w-4 h-4" /> Routines
                </button>
                <button
                  onClick={() => goToSection('meals')}
                  onMouseEnter={prefetchMeals}
                  onFocus={prefetchMeals}
                  onTouchStart={prefetchMeals}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'meals' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  <UtensilsCrossed className="w-4 h-4" /> Meals
                </button>
              </nav>
            )}

            {profile?.role !== 'parent' && (
              <nav className={cn("hidden md:flex gap-1 p-1 rounded-2xl", isDarkTheme ? "bg-ui-dark-50" : "bg-ui-soft-2")}>
                 <button
                   onClick={() => setSelectedCategoryId(null)}
                   className={cn(
                     "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                     !selectedCategoryId ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                   )}
                 >
                   All
                 </button>
                 {categories.map(cat => (
                   <button
                     key={cat.id}
                     onClick={() => setSelectedCategoryId(cat.id)}
                     className={cn(
                       "px-4 py-2 rounded-xl text-sm font-semibold transition-all gap-2 flex items-center",
                       selectedCategoryId === cat.id ? cn(cat.color, "text-white shadow-sm") : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                     )}
                   >
                     <span>{cat.icon}</span>
                     <span className="hidden lg:inline">{cat.name}</span>
                   </button>
                 ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {profile?.role === 'parent' && isLocked && (
              <button
                onClick={() => setShowUnlockPrompt(true)}
                className={cn(
                  "hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors z-[61]",
                  isDarkTheme
                    ? "bg-amber-500/10 text-amber-200 border-amber-400/50 hover:bg-amber-500/20"
                    : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                )}
                aria-label="Display locked. Unlock parent controls"
                title="Display locked. Unlock parent controls"
              >
                <Lock className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-[0.18em]">Locked</span>
              </button>
            )}
            {profile?.role === 'parent' && (
              <button
                onClick={() => {
                  if (isLocked) {
                    setShowUnlockPrompt(true);
                    return;
                  }
                  startTransition(() => {
                    setShowSettings(true);
                  });
                }}
                onMouseEnter={prefetchSettings}
                onFocus={prefetchSettings}
                onTouchStart={prefetchSettings}
                className={cn(
                  "p-2 rounded-xl border transition-colors flex items-center gap-2 z-[61]",
                  isLocked
                    ? (isDarkTheme
                      ? "text-amber-200 border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20"
                      : "text-amber-900 border-amber-300 bg-amber-50 hover:bg-amber-100")
                    : (isDarkTheme
                      ? "text-ui-secondary border-ui-dark-3 hover:text-white hover:bg-ui-dark-2"
                      : "text-ui-muted-2 border-ui hover:text-ui-primary hover:bg-ui-soft")
                )}
                aria-label={isLocked ? "Display locked. Unlock to open settings" : "Settings"}
                title={isLocked ? "Display locked. Unlock to open settings" : "Settings"}
              >
                {isLocked ? <Lock className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                <span className="text-xs font-bold hidden xs:inline">{isLocked ? 'Unlock' : 'Settings'}</span>
              </button>
            )}
            <div className="relative group">
              <button
                onClick={() => setShowProfileSwitcher((v) => !v)}
                className="w-10 h-10 bg-ui-soft-2 border border-ui rounded-full flex items-center justify-center text-ui-muted-2 hover:text-sky-500 transition-colors cursor-pointer"
                title="Switch Profile"
              >
                <UserIcon className="w-5 h-5" />
              </button>
              {showProfileSwitcher && (
                <div className={cn("absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl z-50 p-2", isDarkTheme ? "bg-ui-deep border-ui-dark" : "bg-white border-ui")}>
                  {kids.filter((k) => k.uid !== profile.uid).map((k) => (
                    <button
                      key={k.uid}
                      onClick={() => {
                        setPendingKidSwitch(k);
                        setShowParentSwitchPin(false);
                        setSwitchError('');
                      }}
                      className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-ui-soft transition-colors", isDarkTheme && "hover:bg-ui-dark-2")}
                    >
                      {k.name} <span className="text-xs text-ui-muted">Kid</span>
                    </button>
                  ))}
                  {parentSession && profile.role === 'kid' && (
                    <button
                      onClick={() => {
                        setShowParentSwitchPin(true);
                        setPendingKidSwitch(null);
                        setSwitchError('');
                      }}
                      className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-semibold hover:bg-ui-soft transition-colors", isDarkTheme && "hover:bg-ui-dark-2")}
                    >
                      {parentSession.profile.name} <span className="text-xs text-ui-muted">Parent</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2 text-ui-muted-2 hover:text-rose-500 transition-colors hover:bg-rose-50 rounded-full"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Progress Line (Top Decoration) */}
        {profile.role === 'kid' && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-ui-soft-2 px-8 rounded-b-[2rem] overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn("h-full bg-gradient-to-r transition-all", `from-${currentTheme.primary} to-${currentTheme.accent}`)}
            />
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6">
        {profile.role === 'parent' && isLocked && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Display is locked in read-only mode. Calendar and profiles stay visible, but parent edits are disabled until unlock.
          </div>
        )}

        {isMobile && activeSection === 'home' ? (
          <Suspense fallback={<SectionSkeleton role={profile.role === 'kid' ? 'kid' : 'parent'} activeSection="home" />}>
            <MissionTodayView
              profile={profile}
              tasks={visibleTasks}
              events={visibleEvents}
              completions={allCompletions}
              listItems={visibleListItems}
              lists={globalLists}
              kids={kids}
              categories={categories}
              onAction={handleMissionAction}
            />
          </Suspense>
        ) : (
          <>
            {profile.role === 'parent' && activeSection === 'home' && (
              <Suspense fallback={<SectionSkeleton role={(profile.role as string) === 'kid' ? 'kid' : 'parent'} activeSection="home" />}>
                <WallHome
                  parentId={familyParentId}
                  profile={profile}
                  kids={kids}
                  memberColorMap={memberColorMap}
                  isLocked={isLocked}
                  onManage={() => goToSection('manage')}
                  settings={familySettings}
                />
              </Suspense>
            )}
            {profile.role === 'parent' && activeSection === 'manage' && (
              <div className="space-y-4">
                <div className="mb-4">
                  <button
                    onClick={() => goToSection('home')}
                    className="text-sm text-ui-muted hover:text-ui-primary transition-colors"
                  >
                    ← Back to Home
                  </button>
                </div>
                <Suspense fallback={<SectionSkeleton role={profile.role} activeSection="manage" />}>
                  <ParentDashboard
                    profile={profile}
                    onOpenSettings={() => setShowSettings(true)}
                  />
                </Suspense>
              </div>
            )}
            {profile.role === 'parent' && activeSection === 'calendar' && (
              <Suspense fallback={<SectionSkeleton role={profile.role} activeSection="calendar" />}>
                <CalendarView 
                  parentId={familyParentId} 
                  kids={kids} 
                  memberColorMap={memberColorMap} 
                  isLocked={isLocked} 
                  userRole={profile.role} 
                />
              </Suspense>
            )}
            {profile.role === 'parent' && activeSection === 'tasks' && (
              <Suspense fallback={<SectionSkeleton role={profile.role} activeSection="tasks" />}>
                <ParentTasksWorkspace
                  parentId={familyParentId}
                  kids={kids}
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  isLocked={isLocked}
                  isDarkMode={isDarkTheme}
                  onCategoriesChange={setCategories}
                />
              </Suspense>
            )}
            {profile.role === 'parent' && activeSection === 'meals' && (
              <Suspense fallback={<SectionSkeleton role="parent" activeSection="meals" />}>
                <MealPlanView parentId={familyParentId} />
              </Suspense>
            )}
            {profile.role === 'parent' && activeSection === 'shopping' && (
              <Suspense fallback={<SectionSkeleton role="parent" activeSection="shopping" />}>
                <ShoppingView parentId={familyParentId} />
              </Suspense>
            )}
            {profile.role === 'parent' && activeSection === 'routines' && (
              <Suspense fallback={<SectionSkeleton role="parent" activeSection="routines" />}>
                <RoutinesView parentId={familyParentId} />
              </Suspense>
            )}
            {profile.role !== 'parent' && !['shopping', 'routines'].includes(activeSection) && (
              <Suspense fallback={<SectionSkeleton role="kid" activeSection="home" />}>
                <KidDashboard
                  profile={profile}
                  onProgressChange={setProgress}
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  onProfileUpdate={handleProfileUpdate}
                  kids={kids}
                  memberColorMap={memberColorMap}
                  activeSection={activeSection}
                />
              </Suspense>
            )}
          </>
        )}
      </main>

      {isMobile && (
        <ActionBolt 
          profile={profile}
          onAction={(type) => {
            if (type === 'task') goToSection('tasks');
            else if (type === 'grocery') goToSection('shopping');
          }} 
        />
      )}
      {isMobile && (
        <BottomNav
          activeTab={activeSection}
          role={profile.role}
          onTabSelect={(tab) => {
            if (tab === 'tools') {
              setShowToolsMenu(true);
              return;
            }
            if (tab === 'switch') {
              setShowProfileSwitcher((value) => !value);
              setShowToolsMenu(false);
              return;
            } else {
              setShowToolsMenu(false);
              goToSection(tab as any);
            }
          }}
        />
      )}
      {profile.role === 'parent' && (
        <ToolsMenu
          activeSection={activeSection}
          isOpen={showToolsMenu}
          onClose={() => setShowToolsMenu(false)}
          onSelect={(section) => {
            setShowToolsMenu(false);
            goToSection(section);
          }}
        />
      )}
      {profile.role === "parent" && showUnlockPrompt && (
        <ParentalLockOverlay
          parentId={familyParentId}
          onUnlock={() => {
            setIsLocked(false);
            setShowUnlockPrompt(false);
          }}
          onCancel={() => setShowUnlockPrompt(false)}
        />
      )}
      {profile.role === "parent" && showSettings && (
        <SettingsView
          parentId={familyParentId}
          onClose={() => setShowSettings(false)}
          onLockNow={async () => {
            await settingsClientService.lockDisplay(familyParentId);
            setIsLocked(true);
            setShowSettings(false);
          }}
          onPreviewScreensaver={() => setScreensaverPreview(true)}
          currentThemeId={profile.themeId || 'space_commander'}
          onThemeChange={(themeId) => setProfile(prev => prev ? { ...prev, themeId } : prev)}
        />
      )}
      {pendingKidSwitch && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
          <div className={cn("w-full max-w-sm rounded-2xl p-5 border", isDarkTheme ? "bg-ui-deep border-ui-dark text-white" : "bg-white border-ui")}>
            <h3 className="text-lg font-bold mb-1">Switch to {pendingKidSwitch.name}</h3>
            <p className="text-sm text-ui-muted mb-3">Enter kid Access Key</p>
            <input
              type="password"
              value={kidSwitchPin}
              onChange={(e) => setKidSwitchPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={async (e) => {
                if (e.key !== 'Enter' || kidSwitchPin.length !== 4 || !pendingKidSwitch) return;
                e.preventDefault();
                try {
                  await switchToKidProfile(pendingKidSwitch, kidSwitchPin);
                } catch (err: any) {
                  setSwitchError(err?.message || 'Unable to switch profile');
                } finally {
                  setSwitchingProfileLabel('');
                }
              }}
              placeholder="4-digit PIN"
              className="w-full px-3 py-2 rounded-xl border border-ui bg-white text-ui-primary"
            />
            {switchError && <p className="text-sm text-rose-500 mt-2">{switchError}</p>}
            {switchingProfileLabel && <p className="text-sm text-sky-600 mt-2">{switchingProfileLabel}</p>}
            <div className="flex gap-2 mt-4">
              <button className="flex-1 px-3 py-2 rounded-xl border border-ui" onClick={() => { setPendingKidSwitch(null); setKidSwitchPin(''); setSwitchError(''); }}>
                Cancel
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white font-semibold disabled:opacity-50"
                disabled={kidSwitchPin.length !== 4 || !!switchingProfileLabel}
                onClick={async () => {
                  try {
                    await switchToKidProfile(pendingKidSwitch, kidSwitchPin);
                  } catch (e: any) {
                    setSwitchError(e?.message || 'Unable to switch profile');
                  } finally {
                    setSwitchingProfileLabel('');
                  }
                }}
              >
                {switchingProfileLabel ? 'Switching...' : 'Switch'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showParentSwitchPin && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
          <div className={cn("w-full max-w-sm rounded-2xl p-5 border", isDarkTheme ? "bg-ui-deep border-ui-dark text-white" : "bg-white border-ui")}>
            <h3 className="text-lg font-bold mb-1">Parent Unlock Required</h3>
            <p className="text-sm text-ui-muted mb-3">Enter family PIN or parent password to switch to parent</p>
            <input
              type="password"
              value={parentSwitchPin}
              onChange={(e) => setParentSwitchPin(e.target.value.slice(0, 64))}
              onKeyDown={async (e) => {
                if (e.key !== 'Enter' || parentSwitchPin.length < 4) return;
                e.preventDefault();
                try {
                  await switchToParentProfile(parentSwitchPin);
                } catch {
                  setSwitchError('Incorrect PIN or password');
                } finally {
                  setSwitchingProfileLabel('');
                }
              }}
              placeholder="PIN or password"
              className="w-full px-3 py-2 rounded-xl border border-ui bg-white text-ui-primary"
            />
            {switchError && <p className="text-sm text-rose-500 mt-2">{switchError}</p>}
            {switchingProfileLabel && <p className="text-sm text-sky-600 mt-2">{switchingProfileLabel}</p>}
            <div className="flex gap-2 mt-4">
              <button className="flex-1 px-3 py-2 rounded-xl border border-ui" onClick={() => { setShowParentSwitchPin(false); setParentSwitchPin(''); setSwitchError(''); }}>
                Cancel
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white font-semibold disabled:opacity-50"
                disabled={parentSwitchPin.length < 4 || !!switchingProfileLabel}
                onClick={async () => {
                  try {
                    await switchToParentProfile(parentSwitchPin);
                  } catch {
                    setSwitchError('Incorrect PIN or password');
                  } finally {
                    setSwitchingProfileLabel('');
                  }
                }}
              >
                {switchingProfileLabel ? 'Switching...' : 'Switch'}
              </button>
            </div>
          </div>
        </div>
      )}
      <PhotoScreensaver
        parentId={profile.parentId || profile.uid}
        idleMinutes={5}
        forceIdle={screensaverPreview}
        onDismiss={screensaverPreview ? () => setScreensaverPreview(false) : undefined}
        shuffleEnabled={screensaverShuffle}
        displayDurationSec={screensaverDurationSec}
        showCaptions={screensaverCaptions}
      />

      <footer className="mt-20 pt-10 border-t border-ui mx-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-ui-soft-2 flex items-center justify-center text-emerald-500">
              <Activity className="w-4 h-4" />
            </div>
            <p className="text-xs text-ui-muted font-medium">Synced</p>
            <div className="h-3 w-[1px] bg-ui-soft-3 mx-2"></div>
            <p className="text-[10px] text-ui-muted-2 font-mono tabular-nums">{__BUILD_VERSION__}</p>
          </div>
        </div>
      </footer>
    </div>
    </DisplayContext.Provider>
    </FamilyDataContext.Provider>
  );
}
