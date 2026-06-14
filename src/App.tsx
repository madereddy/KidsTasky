import { fetchAPI } from './services/http';
import { getOfflineQueue, popOfflineAction } from './lib/offline-queue';
import { authService } from './services/auth';
import { userService } from './services/users';
import { subscribeToPush, unsubscribeFromPush } from './services/push';
import { clientLogger } from './services/clientLogger';
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { UserProfile, MissionItem } from './types';
import { cn } from './lib/utils';
import { THEMES, MEMBER_COLORS } from './constants';
import { useSocketStaleData } from './hooks/useSocket';
import { useSleepMode } from './hooks/useSleepMode';
import { DisplayContext } from './contexts/DisplayContext';
import { FamilyDataContext } from './contexts/FamilyDataContext';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useSectionNavigation } from './hooks/useSectionNavigation';

import { ShareTargetHandler } from './components/shared/ShareTargetHandler';
import { ParentalLockOverlay } from './components/shared/ParentalLockOverlay';
import { SleepModeOverlay } from './components/shared/SleepModeOverlay';
import { PhotoScreensaver } from './components/shared/PhotoScreensaver';
import { ShoppingModeOverlay } from './components/shared/ShoppingModeOverlay';
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
import { useProfileSwitchController } from './hooks/useProfileSwitchController';
import { Rocket, Activity, CalendarDays, List, UtensilsCrossed, Settings, Lock, User as UserIcon, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { settingsClientService } from './services/settings';
import { tasksClientService } from './services/tasks';
import { listsClientService } from './services/lists';
import { eventsClientService } from './services/events';
import { homeworkClientService } from './services/homework';
import { mealsClientService } from './services/meals';

const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string
) => lazy(async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  const retryKey = `kidtasker:lazy-retry:${key}`;
  try {
    const mod = await importer();
    sessionStorage.removeItem(retryKey);
    return mod;
  } catch (error) {
    if (sessionStorage.getItem(retryKey) !== '1') {
      sessionStorage.setItem(retryKey, '1');
      if (typeof window !== 'undefined') {
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
          } catch {}
        }
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((cacheKey) => caches.delete(cacheKey)));
          } catch {}
        }
      }
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

const KID_IDLE_RETURN_MS = 5 * 60 * 1000;
const isParentRole = (role?: UserProfile['role']) => role === 'parent' || role === 'coparent';

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
  const {
    user, setUser,
    profile, setProfile,
    familySettings,
    parentSession, setParentSession,
    loading,
    initError,
    kids, setKids,
    categories, setCategories,
    isLocked, setIsLocked,
    sleepStart, sleepEnd,
    screensaverShuffle, screensaverDurationSec, screensaverCaptions,
    timeFormat,
    persistParentSession,
    loadProfileData,
    refreshKids,
    refreshCategories
  } = useAppInitialization();

  const { activeSection, goToSection } = useSectionNavigation();
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showShoppingMode, setShowShoppingMode] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [hiddenMissionIds, setHiddenMissionIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('kidtasker_hidden_missions');
    const today = format(new Date(), 'yyyy-MM-dd');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === today && Array.isArray(parsed.ids)) return new Set(parsed.ids);
      } catch {}
    }
    return new Set();
  });

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    localStorage.setItem('kidtasker_hidden_missions', JSON.stringify({ date: today, ids: Array.from(hiddenMissionIds) }));
  }, [hiddenMissionIds]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleResize = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { isSleeping: isSleepScheduled } = useSleepMode({ sleepStart, sleepEnd });
  const [sleepDismissed, setSleepDismissed] = useState(false);
  const isSleepMode = isSleepScheduled && !sleepDismissed;
  useEffect(() => { if (!isSleepScheduled) setSleepDismissed(false); }, [isSleepScheduled]);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
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
          await fetchAPI(action.endpoint, { method: action.method, body: action.body, skipQueue: true }, 0);
        } catch (e: any) {
          if (e.status === 0) {
            const currentQueue = getOfflineQueue();
            localStorage.setItem('kidtasker_offline_queue', JSON.stringify([action, ...currentQueue]));
            break;
          }
        }
      }
      window.dispatchEvent(new CustomEvent('kidtasker:offline-sync-complete'));
    } finally {
      setSyncing(false);
    }
  }, [syncing, isOffline]);

  useEffect(() => { if (!isOffline) void flushQueue(); }, [isOffline, flushQueue]);

  const warmProfile = useCallback((u: UserProfile) => {
    const parentId = u.parentId || u.uid;
    if (!parentId) return;
    runIdle(() => {
      prefetchParentTasks(); prefetchCalendar(); prefetchShopping(); prefetchRoutines(); prefetchMeals(); prefetchSettings();
      if (isParentRole(u.role)) {
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

  const {
    showProfileSwitcher, setShowProfileSwitcher,
    pendingKidSwitch, setPendingKidSwitch,
    kidSwitchPin, setKidSwitchPin,
    showParentSwitchPin, setShowParentSwitchPin,
    parentSwitchPin, setParentSwitchPin,
    switchError, setSwitchError,
    switchingProfileLabel, setSwitchingProfileLabel,
    switchToKidProfile, switchToParentProfile,
  } = useProfileSwitchController({
    profile, user, parentSession, persistParentSession, loadProfileData, warmProfile,
    setUser: (next) => setUser(next),
    setProfile: (next) => setProfile(next),
    setIsLocked,
  });

  const memberColorMap = useMemo(() => {
    if (!profile) return {};
    return [profile, ...kids].reduce((acc, u) => {
      acc[u.uid] = u.color ?? MEMBER_COLORS[0];
      return acc;
    }, {} as Record<string, string>);
  }, [profile, kids]);

  const familyParentId = profile?.parentId || profile?.uid || '';
  const { allTasks, allCompletions, events, fetchFamilyData: refreshWallData, lists: globalLists, listItems: globalListItems, frequentItems } = useWallHomeController({ parentId: familyParentId, kids, initialSettings: familySettings });
  const { toggleItem: toggleListItem } = useListsController({ parentId: familyParentId });

  const handleMissionAction = useCallback(async (item: MissionItem, action: 'complete' | 'dismiss') => {
    if (!profile) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    setHiddenMissionIds(prev => new Set([...prev, item.id]));
    if (action === 'complete') {
      if (item.type === 'task') await tasksClientService.completeTask(item.originalData.id, item.assignedToId || profile.uid, today);
      else if (item.type === 'list_item') await toggleListItem(item.originalData.id, true);
      else if (item.type === 'routine') {
        const routineItems = globalListItems.filter(li => li.listId === item.originalData.id && li.completed === 0);
        await Promise.all(routineItems.map(li => toggleListItem(li.id, true)));
      }
      refreshWallData();
    } else if (action === 'dismiss') {
      if (item.type === 'task') await tasksClientService.skipTask(item.originalData.id, item.assignedToId || profile.uid, today);
      refreshWallData();
    }
  }, [profile, refreshWallData, toggleListItem, globalListItems]);

  useEffect(() => {
    if (!profile || profile.role !== 'kid' || !parentSession) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const parent = parentSession.profile;
          localStorage.setItem('kidtasker_token', parentSession.token);
          const refreshed = await authService.getMe(parentSession.token);
          const next = refreshed && isParentRole(refreshed.role) ? refreshed : parent;
          setUser({ uid: next.uid, name: next.name, email: next.email });
          setProfile(next);
          goToSection('home');
          await loadProfileData(next);
          if (next.parentId || next.uid) { await settingsClientService.lockDisplay(next.parentId || next.uid).catch(() => {}); setIsLocked(true); }
        } catch {}
      }, KID_IDLE_RETURN_MS);
    };
    ['mousemove', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, resetIdle));
    resetIdle();
    return () => { ['mousemove', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, resetIdle)); clearTimeout(timer); };
  }, [loadProfileData, parentSession, profile, goToSection, setIsLocked, setProfile, setUser]);

  const currentTheme = THEMES.find(t => t.id === (profile?.themeId || 'space_commander')) || THEMES[0];
  const isDarkTheme = !!currentTheme.vocab?.darkMode;

  if (loading) return (
    <div className="min-h-screen bg-ui-soft p-6">
      <div className="max-w-7xl mx-auto">
        <header className="h-16 mb-8 rounded-[2rem] bg-white/80 border border-ui flex items-center px-6 justify-between">
          <div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-xl" /><Skeleton className="w-32 h-6" /></div>
          <div className="flex gap-4"><Skeleton className="w-10 h-10 rounded-full" /><Skeleton className="w-10 h-10 rounded-full" /></div>
        </header>
        <WallSkeleton />
      </div>
    </div>
  );

  if (initError) return (
    <div className="min-h-screen bg-ui-soft flex items-center justify-center flex-col gap-4">
      <p className="text-ui-muted font-medium">Failed to connect to server</p>
      <button onClick={() => window.location.reload()} className="px-6 py-3 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-400 transition-colors">Retry</button>
    </div>
  );

  if (!user) return <LoginView 
    onLogin={async (email, pwd, isReg, name) => {
      const res = isReg ? await authService.register(email, pwd, name || '') : await authService.signIn(email, pwd);
      if (res) {
        const { user: u, token } = res; setUser({ uid: u.uid, name: u.name, email: u.email });
        localStorage.setItem('kidtasker_token', token);
        if (u.role) {
          setProfile(u); if (u.role === 'kid') void loadProfileData(u, { fastKidSwitch: true }); else await loadProfileData(u);
          if (u.role === 'parent') persistParentSession({ token, user: { uid: u.uid, name: u.name, email: u.email }, profile: u });
          warmProfile(u);
        }
        subscribeToPush().catch(() => {});
      } else alert('Error during login');
    }}
    onKidLogin={async (uid, pin) => {
      const res = await authService.signInKid(uid, pin);
      if (res) {
        const { user: u, token } = res; setUser({ uid: u.uid, name: u.name, email: u.email });
        localStorage.setItem('kidtasker_token', token);
        if (u.role) { setProfile(u); void loadProfileData(u, { fastKidSwitch: true }); warmProfile(u); }
        subscribeToPush().catch(() => {});
      } else alert('Invalid Access Key');
    }}
  />;

  if (!profile) return <OnboardingView user={{ uid: user.uid, email: user.email, name: user.name }} onComplete={async (p) => { setProfile(p); await loadProfileData(p); warmProfile(p); subscribeToPush().catch(() => {}); }} />;

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
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h1 className={cn("text-xl font-bold tracking-tight hidden sm:block", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                {isParentRole(profile.role) ? 'Family Hub' : currentTheme.vocab?.hub || 'My Chores'}
              </h1>
              {isOffline && <div className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full animate-pulse ml-2 whitespace-nowrap"><span>☁️ Offline</span></div>}
              {syncing && <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full ml-2 whitespace-nowrap"><Activity className="w-3 h-3 animate-spin" /><span>Syncing...</span></div>}
            </div>
            {isParentRole(profile?.role) && (
              <nav className={cn("hidden md:flex gap-1 p-1 rounded-2xl", isDarkTheme ? "bg-ui-dark-50" : "bg-ui-soft-2")}>
                {(['home', 'tasks', 'calendar', 'shopping', 'routines', 'meals'] as const).map(sec => (
                  <button key={sec} onClick={() => goToSection(sec)} className={cn("px-4 py-2 rounded-xl text-sm font-semibold transition-all", activeSection === sec ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary"))}>
                    {sec.charAt(0).toUpperCase() + sec.slice(1)}
                  </button>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isParentRole(profile?.role) && isLocked && (
              <div className={cn("hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border z-[61]", isDarkTheme ? "bg-amber-500/10 text-amber-200 border-amber-400/50" : "bg-amber-50 text-amber-900 border-amber-300")}>
                <Lock className="w-4 h-4" /><span className="text-xs font-black uppercase tracking-[0.18em]">Locked</span>
              </div>
            )}
            {isParentRole(profile?.role) && (
              <button onClick={() => isLocked ? setShowUnlockPrompt(true) : setShowSettings(true)} className={cn("p-2 rounded-xl border transition-colors flex items-center gap-2 z-[61]", isLocked ? (isDarkTheme ? "text-amber-200 border-amber-400/50 bg-amber-500/10" : "text-amber-900 border-amber-300 bg-amber-50") : (isDarkTheme ? "text-ui-secondary border-ui-dark-3 hover:text-white" : "text-ui-muted-2 border-ui hover:text-ui-primary hover:bg-ui-soft"))}>
                {isLocked ? <Lock className="w-5 h-5" /> : <Settings className="w-5 h-5" />}<span className="text-xs font-bold hidden xs:inline">{isLocked ? 'Unlock' : 'Settings'}</span>
              </button>
            )}
            <div className="relative">
              <button onClick={() => setShowProfileSwitcher(!showProfileSwitcher)} className="w-10 h-10 bg-ui-soft-2 border border-ui rounded-full flex items-center justify-center text-ui-muted-2 hover:text-sky-500 transition-colors"><UserIcon className="w-5 h-5" /></button>
              {showProfileSwitcher && (
                <div className={cn("absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl z-50 p-2", isDarkTheme ? "bg-ui-deep border-ui-dark" : "bg-white border-ui")}>
                  {kids.filter(k => k.uid !== profile.uid).map(k => <button key={k.uid} onClick={() => { setPendingKidSwitch(k); setShowParentSwitchPin(false); setSwitchError(''); }} className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-ui-soft", isDarkTheme && "hover:bg-ui-dark-2")}>{k.name} <span className="text-xs text-ui-muted">Kid</span></button>)}
                  {parentSession && profile.role === 'kid' && <button onClick={() => { setShowParentSwitchPin(true); setPendingKidSwitch(null); setSwitchError(''); }} className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-semibold hover:bg-ui-soft", isDarkTheme && "hover:bg-ui-dark-2")}>{parentSession.profile.name} <span className="text-xs text-ui-muted">Parent</span></button>}
                </div>
              )}
            </div>
            <button onClick={async () => { await unsubscribeFromPush().catch(() => {}); localStorage.removeItem('kidtasker_token'); persistParentSession(null); setUser(null); setProfile(null); }} className="p-2 text-ui-muted-2 hover:text-rose-500 transition-colors hover:bg-rose-50 rounded-full"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto max-w-7xl px-4 sm:px-6", isMobile ? "pb-[calc(7.5rem+env(safe-area-inset-bottom))]" : "pb-10")}>
        {isMobile && activeSection === 'home' ? (
          <Suspense fallback={<SectionSkeleton role={profile.role === 'kid' ? 'kid' : 'parent'} activeSection="home" />}><MissionTodayView profile={profile} tasks={allTasks.filter(t => !hiddenMissionIds.has(`task_${t.id}`))} events={events.filter(e => !hiddenMissionIds.has(`event_${e.id}`))} completions={allCompletions} listItems={globalListItems.filter(l => !hiddenMissionIds.has(`list_${l.id}`))} lists={globalLists} frequentItems={frequentItems} kids={kids} categories={categories} onAction={handleMissionAction} onRefresh={refreshWallData} /></Suspense>
        ) : (
          <>
            {isParentRole(profile.role) && activeSection === 'home' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="home" />}><WallHome parentId={familyParentId} profile={profile} kids={kids} memberColorMap={memberColorMap} isLocked={isLocked} onManage={() => goToSection('manage')} settings={familySettings} /></Suspense>}
            {isParentRole(profile.role) && activeSection === 'manage' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="manage" />}><ParentDashboard profile={profile} onOpenSettings={() => setShowSettings(true)} /></Suspense>}
            {isParentRole(profile.role) && activeSection === 'calendar' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="calendar" />}><CalendarView parentId={familyParentId} kids={kids} memberColorMap={memberColorMap} isLocked={isLocked} userRole={profile.role} /></Suspense>}
            {isParentRole(profile.role) && activeSection === 'tasks' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="tasks" />}><ParentTasksWorkspace parentId={familyParentId} kids={kids} categories={categories} selectedCategoryId={selectedCategoryId} isLocked={isLocked} isDarkMode={isDarkTheme} onCategoriesChange={setCategories} /></Suspense>}
            {isParentRole(profile.role) && activeSection === 'meals' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="meals" />}><MealPlanView parentId={familyParentId} /></Suspense>}
            {isParentRole(profile.role) && activeSection === 'shopping' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="shopping" />}><ShoppingView parentId={familyParentId} /></Suspense>}
            {isParentRole(profile.role) && activeSection === 'routines' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="routines" />}><RoutinesView parentId={familyParentId} /></Suspense>}
            {!isParentRole(profile.role) && <Suspense fallback={<SectionSkeleton role="kid" activeSection="home" />}><KidDashboard profile={profile} onProgressChange={setProgress} categories={categories} selectedCategoryId={selectedCategoryId} onProfileUpdate={() => userService.getUserProfile(user.uid).then(setProfile)} kids={kids} memberColorMap={memberColorMap} activeSection={activeSection} /></Suspense>}
          </>
        )}
      </main>

      {isMobile && <ActionBolt profile={profile} onAction={(type) => { if (type === 'task') goToSection('tasks'); else if (type === 'grocery') goToSection('shopping'); else if (type === 'shopping-mode') setShowShoppingMode(true); }} />}
      {showShoppingMode && <ShoppingModeOverlay parentId={familyParentId} onClose={() => setShowShoppingMode(false)} />}
      {isMobile && <BottomNav activeTab={activeSection} role={profile.role} onTabSelect={(tab) => { if (tab === 'tools') setShowToolsMenu(true); else if (tab === 'switch') setShowProfileSwitcher(!showProfileSwitcher); else goToSection(tab as any); }} />}
      {isParentRole(profile.role) && <ToolsMenu activeSection={activeSection} isOpen={showToolsMenu} onClose={() => setShowToolsMenu(false)} onSelect={(s) => goToSection(s as any)} />}
      {isParentRole(profile.role) && showUnlockPrompt && <ParentalLockOverlay parentId={familyParentId} onUnlock={() => { setIsLocked(false); setShowUnlockPrompt(false); }} onCancel={() => setShowUnlockPrompt(false)} />}
      {isParentRole(profile.role) && showSettings && <Suspense fallback={<div className="fixed inset-0 z-[150] bg-white/80 backdrop-blur-md flex items-center justify-center"><div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" /></div>}><SettingsView parentId={familyParentId} onClose={() => setShowSettings(false)} onLockNow={async () => { await settingsClientService.lockDisplay(familyParentId); setIsLocked(true); setShowSettings(false); }} onPreviewScreensaver={() => setScreensaverPreview(true)} currentThemeId={profile.themeId || 'space_commander'} onThemeChange={(themeId) => setProfile(prev => prev ? { ...prev, themeId } : prev)} /></Suspense>}
      {pendingKidSwitch && <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4"><div className={cn("w-full max-w-sm rounded-2xl p-5 border", isDarkTheme ? "bg-ui-deep border-ui-dark text-white" : "bg-white border-ui")}><h3 className="text-lg font-bold">Switch to {pendingKidSwitch.name}</h3><input type="password" value={kidSwitchPin} onChange={(e) => setKidSwitchPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4-digit PIN" className="w-full px-3 py-2 rounded-xl border border-ui mt-3" />{switchError && <p className="text-sm text-rose-500 mt-2">{switchError}</p>}<div className="flex gap-2 mt-4"><button className="flex-1 px-3 py-2 rounded-xl border" onClick={() => { setPendingKidSwitch(null); setKidSwitchPin(''); }}>Cancel</button><button className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white" onClick={async () => { try { await switchToKidProfile(pendingKidSwitch, kidSwitchPin); } catch(e:any){ setSwitchError(e.message); } }}>Switch</button></div></div></div>}
      {showParentSwitchPin && <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4"><div className={cn("w-full max-w-sm rounded-2xl p-5 border", isDarkTheme ? "bg-ui-deep border-ui-dark text-white" : "bg-white border-ui")}><h3 className="text-lg font-bold">Parent Unlock Required</h3><input type="password" value={parentSwitchPin} onChange={(e) => setParentSwitchPin(e.target.value)} placeholder="PIN or password" className="w-full px-3 py-2 rounded-xl border border-ui mt-3" />{switchError && <p className="text-sm text-rose-500 mt-2">{switchError}</p>}<div className="flex gap-2 mt-4"><button className="flex-1 px-3 py-2 rounded-xl border" onClick={() => { setShowParentSwitchPin(false); setParentSwitchPin(''); }}>Cancel</button><button className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white" onClick={async () => { try { await switchToParentProfile(parentSwitchPin); } catch { setSwitchError('Incorrect PIN or password'); } }}>Switch</button></div></div></div>}
      <PhotoScreensaver parentId={profile.parentId || profile.uid} idleMinutes={5} forceIdle={screensaverPreview} onDismiss={screensaverPreview ? () => setScreensaverPreview(false) : undefined} shuffleEnabled={screensaverShuffle} displayDurationSec={screensaverDurationSec} showCaptions={screensaverCaptions} />
      <footer className="mt-20 pt-10 border-t border-ui mx-6 pb-6"><div className="max-w-7xl mx-auto flex justify-between items-center"><div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-ui-soft-2 flex items-center justify-center text-emerald-500"><Activity className="w-4 h-4" /></div><p className="text-xs text-ui-muted font-medium">Synced</p><div className="h-3 w-[1px] bg-ui-soft-3 mx-2" /><p className="text-[10px] text-ui-muted-2 font-mono tabular-nums">{__BUILD_VERSION__}</p></div></div></footer>
    </div>
    </DisplayContext.Provider>
    </FamilyDataContext.Provider>
  );
}
