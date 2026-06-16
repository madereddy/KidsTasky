import { authService } from './services/auth';
import { userService } from './services/users';
import { subscribeToPush, unsubscribeFromPush } from './services/push';
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { UserProfile, MissionItem } from './types';
import { cn } from './lib/utils';
import { THEMES, MEMBER_COLORS } from './constants';
import { useSleepMode } from './hooks/useSleepMode';
import { DisplayContext } from './contexts/DisplayContext';
import { FamilyDataContext } from './contexts/FamilyDataContext';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useSectionNavigation } from './hooks/useSectionNavigation';
import { useHiddenMissions } from './hooks/useHiddenMissions';
import { useOfflineQueueSync } from './hooks/useOfflineQueueSync';

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
import { AppHeader } from './components/shared/AppHeader';
import { KidSwitchDialog, ParentSwitchDialog, ProfileSwitcherSheet } from './components/shared/ProfileSwitchDialogs';
import { useWallHomeController } from './hooks/useWallHomeController';
import { useListsController } from './hooks/useListsController';
import { useProfileSwitchController } from './hooks/useProfileSwitchController';
import { Activity } from 'lucide-react';
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
  const { hiddenMissionIds, setHiddenMissionIds } = useHiddenMissions();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleResize = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  const [selectedCategoryId] = useState<string | null>(null);
  const [, setProgress] = useState(0);
  const { isSleeping: isSleepScheduled } = useSleepMode({ sleepStart, sleepEnd });
  const [sleepDismissed, setSleepDismissed] = useState(false);
  const isSleepMode = isSleepScheduled && !sleepDismissed;
  useEffect(() => { if (!isSleepScheduled) setSleepDismissed(false); }, [isSleepScheduled]);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [openSettingsAfterUnlock, setOpenSettingsAfterUnlock] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsRenderNonce, setSettingsRenderNonce] = useState(0);
  const openSettings = useCallback(() => {
    setShowSettings(true);
    prefetchSettings();
    import('./components/parent/SettingsView')
      .catch(() => undefined)
      .finally(() => setSettingsRenderNonce((value) => value + 1));
  }, []);
  const [screensaverPreview, setScreensaverPreview] = useState(false);
  const [wallJustWoke, setWallJustWoke] = useState(0);
  const { syncing, isOffline } = useOfflineQueueSync();

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
      <AppHeader
        profile={profile}
        kids={kids}
        currentTheme={currentTheme}
        activeSection={activeSection}
        isDarkTheme={isDarkTheme}
        isLocked={isLocked}
        isOffline={isOffline}
        syncing={syncing}
        isMobile={isMobile}
        showProfileSwitcher={showProfileSwitcher}
        parentSession={parentSession}
        onSectionSelect={goToSection}
          onSettingsSelect={openSettings}
        onUnlockSelect={() => { setOpenSettingsAfterUnlock(true); setShowUnlockPrompt(true); }}
        onProfileSwitcherToggle={() => setShowProfileSwitcher(!showProfileSwitcher)}
        onKidSwitchSelect={(kid) => {
          setPendingKidSwitch(kid);
          setShowParentSwitchPin(false);
          setSwitchError('');
        }}
        onParentSwitchSelect={() => {
          setShowParentSwitchPin(true);
          setPendingKidSwitch(null);
          setSwitchError('');
        }}
        onLogout={async () => {
          await unsubscribeFromPush().catch(() => {});
          localStorage.removeItem('kidtasker_token');
          persistParentSession(null);
          setUser(null);
          setProfile(null);
        }}
      />

      <main className={cn("mx-auto max-w-7xl px-4 sm:px-6", isMobile ? "pb-[calc(7.5rem+env(safe-area-inset-bottom))]" : "pb-10")}>
        {isMobile && activeSection === 'home' ? (
          <Suspense fallback={<SectionSkeleton role={profile.role === 'kid' ? 'kid' : 'parent'} activeSection="home" />}><MissionTodayView profile={profile} tasks={allTasks.filter(t => !hiddenMissionIds.has(`task_${t.id}`))} events={events.filter(e => !hiddenMissionIds.has(`event_${e.id}`))} completions={allCompletions} listItems={globalListItems.filter(l => !hiddenMissionIds.has(`list_${l.id}`))} lists={globalLists} frequentItems={frequentItems} kids={kids} categories={categories} onAction={handleMissionAction} onRefresh={refreshWallData} /></Suspense>
        ) : (
          <>
            {isParentRole(profile.role) && activeSection === 'home' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="home" />}><WallHome parentId={familyParentId} profile={profile} kids={kids} memberColorMap={memberColorMap} isLocked={isLocked} onManage={() => goToSection('manage')} settings={familySettings} justWoke={wallJustWoke} /></Suspense>}
            {isParentRole(profile.role) && activeSection === 'manage' && <Suspense fallback={<SectionSkeleton role="parent" activeSection="manage" />}><ParentDashboard profile={profile} onOpenSettings={openSettings} /></Suspense>}
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
      {isParentRole(profile.role) && <ToolsMenu activeSection={activeSection} isOpen={showToolsMenu} isDarkTheme={isDarkTheme} onClose={() => setShowToolsMenu(false)} onSelect={(s) => goToSection(s as any)} />}
      {isMobile && showProfileSwitcher && (
        <ProfileSwitcherSheet
          profile={profile}
          kids={kids}
          parentSession={parentSession}
          isDarkTheme={isDarkTheme}
          onKidSelect={(kid) => { setPendingKidSwitch(kid); setShowParentSwitchPin(false); setSwitchError(''); setShowProfileSwitcher(false); }}
          onParentSelect={() => { setShowParentSwitchPin(true); setPendingKidSwitch(null); setSwitchError(''); setShowProfileSwitcher(false); }}
          onClose={() => setShowProfileSwitcher(false)}
        />
      )}
      {isParentRole(profile.role) && showUnlockPrompt && <ParentalLockOverlay parentId={familyParentId} onUnlock={() => { setIsLocked(false); setShowUnlockPrompt(false); if (openSettingsAfterUnlock) { setShowSettings(true); setOpenSettingsAfterUnlock(false); } }} onCancel={() => setShowUnlockPrompt(false)} />}
      {isParentRole(profile.role) && showSettings && <Suspense fallback={<div className="fixed inset-0 z-[150] bg-white/80 backdrop-blur-md flex items-center justify-center"><div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" /></div>}><SettingsView key={settingsRenderNonce} parentId={familyParentId} onClose={() => setShowSettings(false)} onLockNow={async () => { await settingsClientService.lockDisplay(familyParentId); setIsLocked(true); setShowSettings(false); }} onPreviewScreensaver={() => setScreensaverPreview(true)} currentThemeId={profile.themeId || 'space_commander'} onThemeChange={(themeId) => setProfile(prev => prev ? { ...prev, themeId } : prev)} /></Suspense>}
      {pendingKidSwitch && (
        <KidSwitchDialog
          pendingKidSwitch={pendingKidSwitch}
          kidSwitchPin={kidSwitchPin}
          switchError={switchError}
          isDarkTheme={isDarkTheme}
          onPinChange={setKidSwitchPin}
          onCancel={() => { setPendingKidSwitch(null); setKidSwitchPin(''); }}
          onSwitch={async () => {
            try {
              await switchToKidProfile(pendingKidSwitch, kidSwitchPin);
            } catch (e: any) {
              setSwitchError(e.message);
            }
          }}
        />
      )}
      {showParentSwitchPin && parentSession && (
        <ParentSwitchDialog
          parentName={parentSession.profile.name}
          parentSwitchPin={parentSwitchPin}
          switchError={switchError}
          isDarkTheme={isDarkTheme}
          onPinChange={setParentSwitchPin}
          onCancel={() => { setShowParentSwitchPin(false); setParentSwitchPin(''); }}
          onSwitch={async () => {
            try {
              await switchToParentProfile(parentSwitchPin);
            } catch {
              setSwitchError('Incorrect PIN or password');
            }
          }}
        />
      )}
      <PhotoScreensaver
        parentId={profile.parentId || profile.uid}
        idleMinutes={5}
        forceIdle={screensaverPreview}
        onDismiss={() => {
          if (screensaverPreview) {
            setScreensaverPreview(false);
          } else {
            setWallJustWoke(Date.now());
          }
        }}
        shuffleEnabled={screensaverShuffle}
        displayDurationSec={screensaverDurationSec}
        showCaptions={screensaverCaptions}
      />
      <footer className="mt-20 pt-10 border-t border-ui mx-6 pb-6 hidden md:block"><div className="max-w-7xl mx-auto flex justify-between items-center"><div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-ui-soft-2 flex items-center justify-center text-emerald-500"><Activity className="w-4 h-4" /></div><p className="text-xs text-ui-muted font-medium">Synced</p><div className="h-3 w-[1px] bg-ui-soft-3 mx-2" /><p className="text-[10px] text-ui-muted-2 font-mono tabular-nums">{__BUILD_VERSION__}</p></div></div></footer>
    </div>
    </DisplayContext.Provider>
    </FamilyDataContext.Provider>
  );
}
