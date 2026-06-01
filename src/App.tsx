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
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { LogOut, Rocket, User as UserIcon, Activity, CalendarDays, List, UtensilsCrossed, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Category } from './types';
import { cn } from './lib/utils';
import { THEMES, MEMBER_COLORS } from './constants';
import { initSocket, useSocketStaleData } from './hooks/useSocket';
import { useSleepMode } from './hooks/useSleepMode';
import { DisplayContext } from './contexts/DisplayContext';
import { FamilyDataContext } from './contexts/FamilyDataContext';

import { ParentalLockOverlay } from './components/shared/ParentalLockOverlay';
import { SleepModeOverlay } from './components/shared/SleepModeOverlay';
import { PhotoScreensaver } from './components/shared/PhotoScreensaver';
import { LoginView } from './components/auth/LoginView';
import { OnboardingView } from './components/onboarding/OnboardingView';
import { WallHome } from './components/parent/WallHome';
import { KidDashboard } from './components/kid/KidDashboard';

const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string
) => lazy(async () => {
  try {
    return await importer();
  } catch (error) {
    const retryKey = `kidtasker:lazy-retry:${key}`;
    const retried = sessionStorage.getItem(retryKey) === '1';
    if (!retried) {
      sessionStorage.setItem(retryKey, '1');
      window.location.reload();
    }
    throw error;
  }
});

const ParentDashboard = lazyWithRetry(() => import('./components/parent/ParentDashboard').then(m => ({ default: m.ParentDashboard })), 'parent-dashboard');
const ParentTasksWorkspace = lazyWithRetry(() => import('./components/parent/ParentTasksWorkspace').then(m => ({ default: m.ParentTasksWorkspace })), 'parent-tasks');
const CalendarView = lazyWithRetry(() => import('./components/calendar/CalendarView').then(m => ({ default: m.CalendarView })), 'calendar');
const ListsView = lazyWithRetry(() => import('./components/lists/ListsView').then(m => ({ default: m.ListsView })), 'lists');
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
const prefetchLists = () => { import('./components/lists/ListsView'); };
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
  const [parentSession, setParentSession] = useState<{ token: string; user: AppUser; profile: UserProfile } | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'home' | 'tasks' | 'calendar' | 'lists' | 'meals' | 'manage'>('home');
  const [kids, setKids] = useState<UserProfile[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [sleepStart, setSleepStart] = useState<string | undefined>(undefined);
  const [sleepEnd, setSleepEnd] = useState<string | undefined>(undefined);
  const [screensaverShuffle, setScreensaverShuffle] = useState(false);
  const [screensaverDurationSec, setScreensaverDurationSec] = useState(10);
  const [screensaverCaptions, setScreensaverCaptions] = useState(true);
  const { isSleeping: isSleepScheduled } = useSleepMode({ sleepStart, sleepEnd });
  const isSleepMode = isSleepScheduled;
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [initError, setInitError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [screensaverPreview, setScreensaverPreview] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [pendingKidSwitch, setPendingKidSwitch] = useState<UserProfile | null>(null);
  const [kidSwitchPin, setKidSwitchPin] = useState('');
  const [showParentSwitchPin, setShowParentSwitchPin] = useState(false);
  const [parentSwitchPin, setParentSwitchPin] = useState('');
  const [switchError, setSwitchError] = useState('');
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

  const loadProfileData = useCallback(async (u: UserProfile, options?: { fastKidSwitch?: boolean }) => {
    const parentId = u.parentId || u.uid;
    if (!parentId) return;
    initSocket(parentId);
    const [cats, familyKids, settings] = await Promise.all([
      categoryService.getCategories(parentId).catch(() => []),
      options?.fastKidSwitch && u.role === 'kid'
        ? Promise.resolve(kidsRef.current)
        : userService.getKidsForParent(parentId).catch(() => []),
      u.role === 'parent'
        ? settingsClientService.getSettings(parentId).catch(() => null)
        : Promise.resolve(null),
    ]);
    setCategories(cats || []);
    if (familyKids && familyKids.length > 0) setKids(familyKids || []);
    if (u.role === 'parent') {
      setIsLocked(Boolean(settings?.isLocked));
      setSleepStart(settings?.sleepStart);
      setSleepEnd(settings?.sleepEnd);
      if (settings?.screensaverShuffle !== undefined) setScreensaverShuffle(Boolean(settings.screensaverShuffle));
      if (settings?.screensaverDurationSec) setScreensaverDurationSec(settings.screensaverDurationSec);
      if (settings?.screensaverCaptions !== undefined) setScreensaverCaptions(settings.screensaverCaptions !== false);
    } else {
      setIsLocked(false);
    }
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
              void loadProfileData(u, { fastKidSwitch: true });
            } else {
              await loadProfileData(u);
            }
            if (u.role === 'parent') {
              persistParentSession({ token: storedToken, user: { uid: u.uid, name: u.name, email: u.email }, profile: u });
            }
            warmProfile(u);
          } else {
            localStorage.removeItem('kidtasker_token');
          }
        } catch (e) {
          console.error("Auth initialization failed (network or server error)", e);
          setInitError(true);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [loadProfileData, persistParentSession, warmProfile]);

  const handleLogout = async () => {
    await unsubscribeFromPush().catch(console.warn);
    localStorage.removeItem('kidtasker_token');
    persistParentSession(null);
    setUser(null);
    setProfile(null);
  };

  const switchToKidProfile = useCallback(async (kid: UserProfile, pin: string) => {
    if (!profile || !user) return;
    const parentToken = localStorage.getItem('kidtasker_token') || '';
    if (profile.role === 'parent' && parentToken) {
      persistParentSession({ token: parentToken, user, profile });
    }
    const res = await authService.signInKid(kid.uid, pin);
    if (!res) throw new Error('Invalid Access Key');
    const { user: next, token } = res;
    localStorage.setItem('kidtasker_token', token);
    setUser({ uid: next.uid, name: next.name, email: next.email });
    setProfile(next);
    setShowProfileSwitcher(false);
    setPendingKidSwitch(null);
    setKidSwitchPin('');
    setSwitchError('');
    // Make kid switch feel instant; hydrate shared data in background.
    void loadProfileData(next, { fastKidSwitch: true });
    warmProfile(next);
  }, [loadProfileData, persistParentSession, profile, user, warmProfile]);

  const switchToParentProfile = useCallback(async (pin: string) => {
    if (!parentSession) throw new Error('No parent session available');
    const parentId = parentSession.profile.parentId || parentSession.profile.uid;
    if (!parentId) throw new Error('Invalid parent session');
    await settingsClientService.unlockDisplay(parentId, pin);
    localStorage.setItem('kidtasker_token', parentSession.token);
    const refreshed = await authService.getMe(parentSession.token);
    const next = refreshed && refreshed.role === 'parent' ? refreshed : parentSession.profile;
    setUser({ uid: next.uid, name: next.name, email: next.email });
    setProfile(next);
    setShowParentSwitchPin(false);
    setParentSwitchPin('');
    setSwitchError('');
    setShowProfileSwitcher(false);
    setIsLocked(false);
    await loadProfileData(next);
    warmProfile(next);
  }, [loadProfileData, parentSession, warmProfile]);

  const warmProfile = useCallback((u: UserProfile) => {
    const parentId = u.parentId || u.uid;
    if (!parentId) return;
    runIdle(() => {
      prefetchParentTasks();
      prefetchCalendar();
      prefetchLists();
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
    setKids(nextKids || []);
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

  const currentThemeId = profile?.themeId || 'space';
  const currentTheme = THEMES.find(t => t.id === currentThemeId) || THEMES[0];
  const isDarkTheme = !!currentTheme.vocab?.darkMode;
  const familyParentId = profile?.parentId || profile?.uid || '';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-ui-soft flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full"
        />
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
              subscribeToPush().catch(console.warn);
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
              subscribeToPush().catch(console.warn);
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
            subscribeToPush().catch(console.warn);
          }} 
        />
      </div>
    );
  }

  return (
    <FamilyDataContext.Provider value={{ kids, categories, memberColorMap, refreshKids, refreshCategories }}>
    <DisplayContext.Provider value={{ isWallMode: isLocked, isSleepMode }}>
    <SleepModeOverlay isActive={isSleepMode} />
    <div className={cn("min-h-screen selection:bg-sky-500/30 overflow-x-hidden pb-12 transition-colors duration-500", currentTheme.vocab?.darkMode ? "text-white theme-dark" : "text-ui-primary theme-light", isLocked && "wall-mode")} style={{ background: currentTheme.bg }}>
      <header className={cn("sticky top-0 z-40 backdrop-blur-xl border-b mx-4 mt-4 rounded-[2rem] px-6 py-3 mb-8 shadow-sm", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-ui")}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl bg-gradient-to-br", `from-${currentTheme.primary} to-${currentTheme.accent}`, "shadow-sm")}>
                <Rocket className={cn("w-6 h-6", currentTheme.vocab?.darkMode ? "text-white" : "text-white")} />
              </div>
              <h1 className={cn("text-xl font-bold tracking-tight hidden sm:block", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                {profile.role === 'parent' ? 'Family Hub' : currentTheme.vocab?.hub || 'My Chores'}
              </h1>
            </div>
            
            <div className="h-8 w-[1px] bg-ui-soft-3 hidden sm:block" />

            {profile?.role === 'parent' && (
              <nav className={cn("hidden md:flex gap-1 p-1 rounded-2xl", isDarkTheme ? "bg-ui-dark-50" : "bg-ui-soft-2")}>
                <button
                  onClick={() => setActiveSection('home')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                    activeSection === 'home' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  Home
                </button>
                <button
                  onClick={() => setActiveSection('tasks')}
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
                  onClick={() => setActiveSection('calendar')}
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
                  onClick={() => setActiveSection('lists')}
                  onMouseEnter={prefetchLists}
                  onFocus={prefetchLists}
                  onTouchStart={prefetchLists}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'lists' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary")
                  )}
                >
                  <List className="w-4 h-4" /> Lists
                </button>
                <button
                  onClick={() => setActiveSection('meals')}
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
            {profile?.role === 'parent' && (
              <button
                onClick={() => {
                  if (isLocked) {
                    setShowUnlockPrompt(true);
                    return;
                  }
                  setShowSettings(true);
                }}
                onMouseEnter={prefetchSettings}
                onFocus={prefetchSettings}
                onTouchStart={prefetchSettings}
                className={cn(
                  "p-2 rounded-full border transition-colors",
                  isDarkTheme
                    ? "text-ui-secondary border-ui-dark-3 hover:text-white hover:bg-ui-dark-2"
                    : "text-ui-muted-2 border-ui hover:text-ui-primary hover:bg-ui-soft"
                )}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            {profile?.role === 'parent' && isLocked && (
              <button
                onClick={() => setShowUnlockPrompt(true)}
                className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-300 hover:bg-amber-200 transition-colors"
                title="Unlock parent controls"
              >
                Unlock
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
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <AnimatePresence mode="wait">
          {profile.role === 'parent' && activeSection === 'home' && (
            <motion.div
              key="parent-home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <WallHome
                parentId={familyParentId}
                profile={profile}
                kids={kids}
                memberColorMap={memberColorMap}
                isLocked={isLocked}
                onManage={() => setActiveSection('manage')}
              />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'manage' && (
            <motion.div
              key="parent-manage"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4">
                <button
                  onClick={() => setActiveSection('home')}
                  className="text-sm text-ui-muted hover:text-ui-primary transition-colors"
                >
                  ← Back to Home
                </button>
              </div>
              <ParentDashboard
                profile={profile}
              />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'calendar' && (
            <motion.div
              key="calendar-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <CalendarView 
                parentId={familyParentId} 
                kids={kids} 
                memberColorMap={memberColorMap} 
                isLocked={isLocked} 
                userRole={profile.role} 
              />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'tasks' && (
            <motion.div
              key="tasks-workspace"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ParentTasksWorkspace
                parentId={familyParentId}
                kids={kids}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                isLocked={isLocked}
                isDarkMode={isDarkTheme}
                onCategoriesChange={setCategories}
              />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'lists' && (
            <motion.div
              key="lists-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ListsView parentId={familyParentId} />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'meals' && (
            <motion.div key="meals-view" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
              <MealPlanView parentId={familyParentId} />
            </motion.div>
          )}
          {profile.role !== 'parent' && (
            <motion.div
              key="kid-dash"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <KidDashboard
                profile={profile}
                onProgressChange={setProgress}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onProfileUpdate={handleProfileUpdate}
                kids={kids}
                memberColorMap={memberColorMap}
              />
            </motion.div>
          )}
          </AnimatePresence>
        </Suspense>
      </main>
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
              placeholder="4-digit PIN"
              className="w-full px-3 py-2 rounded-xl border border-ui bg-white text-ui-primary"
            />
            {switchError && <p className="text-sm text-rose-500 mt-2">{switchError}</p>}
            <div className="flex gap-2 mt-4">
              <button className="flex-1 px-3 py-2 rounded-xl border border-ui" onClick={() => { setPendingKidSwitch(null); setKidSwitchPin(''); setSwitchError(''); }}>
                Cancel
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white font-semibold disabled:opacity-50"
                disabled={kidSwitchPin.length !== 4}
                onClick={async () => {
                  try {
                    await switchToKidProfile(pendingKidSwitch, kidSwitchPin);
                  } catch (e: any) {
                    setSwitchError(e?.message || 'Unable to switch profile');
                  }
                }}
              >
                Switch
              </button>
            </div>
          </div>
        </div>
      )}
      {showParentSwitchPin && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
          <div className={cn("w-full max-w-sm rounded-2xl p-5 border", isDarkTheme ? "bg-ui-deep border-ui-dark text-white" : "bg-white border-ui")}>
            <h3 className="text-lg font-bold mb-1">Parent PIN Required</h3>
            <p className="text-sm text-ui-muted mb-3">Enter family PIN to switch to parent</p>
            <input
              type="password"
              value={parentSwitchPin}
              onChange={(e) => setParentSwitchPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="PIN"
              className="w-full px-3 py-2 rounded-xl border border-ui bg-white text-ui-primary"
            />
            {switchError && <p className="text-sm text-rose-500 mt-2">{switchError}</p>}
            <div className="flex gap-2 mt-4">
              <button className="flex-1 px-3 py-2 rounded-xl border border-ui" onClick={() => { setShowParentSwitchPin(false); setParentSwitchPin(''); setSwitchError(''); }}>
                Cancel
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white font-semibold disabled:opacity-50"
                disabled={parentSwitchPin.length < 4}
                onClick={async () => {
                  try {
                    await switchToParentProfile(parentSwitchPin);
                  } catch {
                    setSwitchError('Incorrect PIN');
                  }
                }}
              >
                Switch
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
          </div>
        </div>
      </footer>
    </div>
    </DisplayContext.Provider>
    </FamilyDataContext.Provider>
  );
}
