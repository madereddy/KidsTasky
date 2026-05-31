import { authService } from './services/auth';
import { userService } from './services/users';
import { categoryService } from './services/categories';
import { settingsClientService } from './services/settings';
import { subscribeToPush, unsubscribeFromPush } from './services/push';
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { LogOut, Rocket, User as UserIcon, Activity, CalendarDays, List, UtensilsCrossed, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Category } from './types';
import { cn } from './lib/utils';
import { THEMES, MEMBER_COLORS } from './constants';
import { initSocket, useSocketStaleData } from './hooks/useSocket';

import { ParentalLockOverlay } from './components/shared/ParentalLockOverlay';
import { PhotoScreensaver } from './components/shared/PhotoScreensaver';
import { LoginView } from './components/auth/LoginView';
import { OnboardingView } from './components/onboarding/OnboardingView';
const ParentDashboard = lazy(() => import('./components/parent/ParentDashboard').then(m => ({ default: m.ParentDashboard })));
const WallHome = lazy(() => import('./components/parent/WallHome').then(m => ({ default: m.WallHome })));
const ParentTasksWorkspace = lazy(() => import('./components/parent/ParentTasksWorkspace').then(m => ({ default: m.ParentTasksWorkspace })));
const KidDashboard = lazy(() => import('./components/kid/KidDashboard').then(m => ({ default: m.KidDashboard })));
const CalendarView = lazy(() => import('./components/calendar/CalendarView').then(m => ({ default: m.CalendarView })));
const ListsView = lazy(() => import('./components/lists/ListsView').then(m => ({ default: m.ListsView })));
const MealPlanView = lazy(() => import('./components/parent/MealPlanView').then(m => ({ default: m.MealPlanView })));
const SettingsView = lazy(() => import('./components/parent/SettingsView').then(m => ({ default: m.SettingsView })));

interface AppUser {
  uid: string;
  email?: string;
  name: string;
  displayName?: string;
}

const prefetchParentTasks = () => { import('./components/parent/ParentTasksWorkspace'); };
const prefetchCalendar = () => { import('./components/calendar/CalendarView'); };
const prefetchLists = () => { import('./components/lists/ListsView'); };
const prefetchMeals = () => { import('./components/parent/MealPlanView'); };
const prefetchSettings = () => { import('./components/parent/SettingsView'); };

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'home' | 'tasks' | 'calendar' | 'lists' | 'meals' | 'manage'>('home');
  const [kids, setKids] = useState<UserProfile[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [initError, setInitError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [screensaverPreview, setScreensaverPreview] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('kidtasker_token');
      if (storedToken) {
        try {
          const u = await authService.getMe(storedToken);
          if (u) {
            setUser({ uid: u.uid, name: u.name, email: u.email });
            setProfile(u);
            const parentId = u.parentId || u.uid;
            if (parentId) {
              initSocket(parentId);
              if (u.role === 'parent') {
                const [cats, k, settings] = await Promise.all([
                  categoryService.getCategories(parentId).catch(() => []),
                  userService.getKidsForParent(parentId).catch(() => []),
                  settingsClientService.getSettings(parentId).catch(() => null),
                ]);
                setCategories(cats || []);
                setKids(k || []);
                if (settings?.isLocked) setIsLocked(true);
              } else {
                const cats = await categoryService.getCategories(parentId).catch(() => []);
                setCategories(cats || []);
              }
            }
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
  }, []);

  const handleLogout = async () => {
    await unsubscribeFromPush().catch(console.warn);
    localStorage.removeItem('kidtasker_token');
    setUser(null);
    setProfile(null);
  };

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
              if (u.role) setProfile(u);
              const parentId = u.parentId || u.uid;
              if (parentId) initSocket(parentId);
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
              if (u.role) setProfile(u);
              const parentId = u.parentId || u.uid;
              if (parentId) initSocket(parentId);
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
            const parentId = p.parentId || p.uid;
            if (parentId) {
              initSocket(parentId);
              const cats = await categoryService.getCategories(parentId);
              setCategories(cats || []);
            }
            subscribeToPush().catch(console.warn);
          }} 
        />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen selection:bg-sky-500/30 overflow-x-hidden pb-12 transition-colors duration-500", currentTheme.vocab?.darkMode ? "text-white theme-dark" : "text-ui-primary theme-light")} style={{ background: currentTheme.bg }}>
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
              <div className="w-10 h-10 bg-ui-soft-2 border border-ui rounded-full flex items-center justify-center text-ui-muted-2 group-hover:text-sky-500 transition-colors cursor-pointer">
                <UserIcon className="w-5 h-5" />
              </div>
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
                parentId={profile.uid}
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
                parentId={profile.uid} 
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
                parentId={profile.uid}
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
              <ListsView parentId={profile.uid} />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'meals' && (
            <motion.div key="meals-view" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
              <MealPlanView parentId={profile.uid} />
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
          parentId={profile.uid}
          onUnlock={() => {
            setIsLocked(false);
            setShowUnlockPrompt(false);
          }}
          onCancel={() => setShowUnlockPrompt(false)}
        />
      )}
      {profile.role === "parent" && showSettings && (
        <SettingsView
          parentId={profile.uid}
          onClose={() => setShowSettings(false)}
          onLockNow={async () => {
            await settingsClientService.lockDisplay(profile.uid);
            setIsLocked(true);
            setShowSettings(false);
          }}
          onPreviewScreensaver={() => setScreensaverPreview(true)}
        />
      )}
      <PhotoScreensaver
        parentId={profile.parentId || profile.uid}
        idleMinutes={5}
        forceIdle={screensaverPreview}
        onDismiss={screensaverPreview ? () => setScreensaverPreview(false) : undefined}
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
  );
}
