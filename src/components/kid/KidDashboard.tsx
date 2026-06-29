import { userService } from '../../services/users';
import { tasksClientService } from '../../services/tasks';
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Clock, CalendarDays, History, Bell, Award, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfToday } from 'date-fns';
import { Task, TaskCompletion, UserProfile, Category } from '../../types';
import { cn } from '../../lib/utils';
import { THEMES } from '../../constants';
import { KidTaskBoard } from './KidTaskBoard';
import { KidHeader } from './dashboard/KidHeader';
import { MissionHistoryModal } from './MissionHistoryModal';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { useSocketStaleData } from '../../hooks/useSocket';
import { AvatarPicker } from '../shared/AvatarPicker';
import { FamilyNote } from '../shared/FamilyNote';
import { WeeklyChoreGrid } from '../shared/WeeklyChoreGrid';
import { RewardsShop } from './RewardsShop';
import { useTaskCompletionController } from '../../hooks/useTaskCompletionController';
import { useKidProgress } from '../../hooks/useKidProgress';
import { useKidMilestones } from '../../hooks/useKidMilestones';
import { useKidRewardsController } from '../../hooks/useKidRewardsController';
import { KidDashboardSkeleton } from '../shared/Skeleton';
import { clientLogger } from '../../services/clientLogger';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { BadgeCollection } from './dashboard/BadgeCollection';
import { CelebrationOverlays } from './dashboard/CelebrationOverlays';

const CalendarView = lazyWithRetry(() => import('../calendar/CalendarView').then(m => ({ default: m.CalendarView })), 'kid-calendar');
const HomeworkView = lazyWithRetry(() => import('../homework/HomeworkView').then(m => ({ default: m.HomeworkView })), 'kid-homework');

export function KidDashboard({
  profile,
  onProgressChange,
  categories,
  selectedCategoryId,
  onProfileUpdate,
  kids,
  memberColorMap,
  activeSection
}: {
  profile: UserProfile,
  onProgressChange: (p: number) => void,
  categories: Category[],
  selectedCategoryId: string | null,
  onProfileUpdate: () => void,
  kids: UserProfile[],
  memberColorMap: Record<string, string>,
  activeSection?: string
}) {
  const currentTheme = THEMES.find(t => t.id === profile.themeId) || THEMES[0];
  const isDarkMode = !!currentTheme.vocab?.darkMode;
  const toneSecondary = currentTheme.vocab?.textSecondary || (isDarkMode ? "text-ui-muted-2" : "text-ui-muted");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(startOfToday(), 'yyyy-MM-dd');
  const [sortBy, setSortBy] = useState<'time' | 'created'>('time');
  const [kidView, setKidView] = useState<'tasks' | 'calendar' | 'homework' | 'shop'>('tasks');
  const [showFilters, setShowFilters] = useState(false);


  useEffect(() => {
    if (!activeSection) return;
    if (activeSection === 'home' || activeSection === 'tasks') setKidView('tasks');
    else if (activeSection === 'calendar') setKidView('calendar');
    else if (activeSection === 'manage') setKidView('shop');
    else if (activeSection === 'lists' || activeSection === 'shopping' || activeSection === 'routines') setKidView('tasks');
  }, [activeSection]);

  const goKidView = useCallback((view: 'tasks' | 'calendar' | 'homework' | 'shop') => {
    setKidView(view);
  }, []);
  const [taskView, setTaskView] = useState<'all' | 'upforgrabs' | 'assigned'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<{ preset?: string; url?: string }>({
    preset: profile.avatarPreset,
    url: profile.avatarUrl,
  });

  const {
    localXp,
    setLocalXp,
    confirmTask,
    setConfirmTask,
    proofAnswers,
    setProofAnswers,
    xpAnimation,
    showStarBurst,
    starsAwarded,
    celebrationTick,
    getCompletion,
    isCompleted,
    isTaskPending,
    toggleTask,
    skipTask,
    executeCompletion,
    setCompletions: syncControllerCompletions,
  } = useTaskCompletionController({
    profile,
    tasks,
    today,
    onProfileUpdate,
  });

  const {
    rewards,
    claimedRewards,
    availableStars,
    loadRewards,
    claimReward,
  } = useKidRewardsController({
    profile,
    parentId: profile.parentId || profile.uid,
    kidId: profile.uid,
    setLocalXp,
    onProfileUpdate,
  });

  const {
    streak,
    filteredTasks,
    totalSlots,
    progressPercent,
    getUrgency,
  } = useKidProgress({
    tasks,
    completions,
    profileUid: profile.uid,
    today,
    selectedCategoryId,
    sortBy,
  });

  const { unlockedBadge, dismissUnlockedBadge } = useKidMilestones({
    profile,
    tasks,
    completions,
    localXp,
    streak,
    loading,
    today,
    onProfileUpdate,
  });

  const isInitialMount = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      if (isInitialMount.current) {
        setLoading(true);
        isInitialMount.current = false;
      }
      await Promise.all([
        tasksClientService.getTasksForKid(profile.uid),
        tasksClientService.getCompletionsForKid(profile.uid, today),
        loadRewards(),
      ]).then(([t, c]) => {
        setTasks(t || []);
        setCompletions(c || []);
        syncControllerCompletions(c || []);
      });
    } catch (e) {
      clientLogger.errorWithException('kid_dashboard_fetch_failed', e, { kidId: profile.uid });
    } finally {
      setLoading(false);
    }
  }, [profile.uid, today, loadRewards, syncControllerCompletions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSocketStaleData(['tasks', 'completions', 'rewards', 'users'], (data) => {
    fetchData();
    const signal = data.type || data.entity;
    if (signal === 'rewards' || signal === 'users') {
      loadRewards().catch((e) => clientLogger.errorWithException('kid_dashboard_rewards_refresh_failed', e, { kidId: profile.uid }));
    }
  });

  const isTaskLocked = (task: Task) => {
    if (!task.prerequisiteTaskIds || task.prerequisiteTaskIds.length === 0) return false;
    return task.prerequisiteTaskIds.some((prereqId: string) => {
      const pTask = tasks.find((t: Task) => t.id === prereqId);
      if (!pTask) return false;
      const reqCount = pTask.frequency === 'twice-daily' ? 2 : 1;
      const comps = completions.filter(c => c.taskId === prereqId).length;
      return comps < reqCount;
    });
  };

  const upForGrabsTasks = filteredTasks.filter((t) => t.assignedKidId === 'all');
  const assignedTasks = filteredTasks.filter((t) => t.assignedKidId !== 'all');
  const taskSections = taskView === 'all'
    ? [
        { key: 'upforgrabs', title: 'Up for Grabs', titleClass: isDarkMode ? 'text-fuchsia-300' : 'text-fuchsia-700', tasks: upForGrabsTasks },
        { key: 'assigned', title: 'Assigned to Me', titleClass: isDarkMode ? 'text-ui-secondary' : 'text-ui-muted', tasks: assignedTasks },
      ]
    : [
        {
          key: taskView,
          title: taskView === 'upforgrabs' ? 'Up for Grabs' : 'Assigned to Me',
          titleClass: taskView === 'upforgrabs'
            ? (isDarkMode ? 'text-fuchsia-300' : 'text-fuchsia-700')
            : (isDarkMode ? 'text-ui-secondary' : 'text-ui-muted'),
          tasks: taskView === 'upforgrabs' ? upForGrabsTasks : assignedTasks,
        },
      ];

  useEffect(() => {
    onProgressChange(progressPercent);
  }, [progressPercent, onProgressChange]);

  const handleThemeSelect = async (themeId: string) => {
    await userService.updateUserTheme(profile.uid, themeId);
    onProfileUpdate();
  };

  if (loading) {
    return <KidDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <style>{`
        body {
          background-image: ${currentTheme.bg} !important;
        }
      `}</style>

      <KidHeader
        profile={profile}
        streak={streak}
        localXp={localXp}
        localAvatar={localAvatar}
        currentTheme={currentTheme}
        onSetEditingAvatar={setEditingAvatar}
        onSetShowThemeSelector={setShowThemeSelector}
      />

      {/* Nav bar */}
      <div className={cn("flex items-center justify-between gap-2 shadow-sm px-4 py-2 rounded-[2rem] border", currentTheme.vocab?.panelBg || "bg-white", currentTheme.vocab?.panelBorder || "border-ui-soft")}>
        <div className={cn("flex gap-1 p-1 rounded-2xl overflow-x-auto", currentTheme.vocab?.darkMode ? "bg-ui-dark-30" : "bg-ui-soft")}>
          <button
            onClick={() => goKidView('tasks')}
            className={cn(
              "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all text-xs font-semibold uppercase tracking-wider whitespace-nowrap",
              kidView === 'tasks' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
            )}
          >
            {currentTheme.vocab?.hub || 'My Chores'}
          </button>
          <button
            onClick={() => goKidView('calendar')}
            className={cn(
              "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap",
              kidView === 'calendar' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
          <button
            onClick={() => goKidView('homework')}
            className={cn(
              "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all text-xs font-semibold uppercase tracking-wider whitespace-nowrap",
              kidView === 'homework' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
            )}
          >
            Homework
          </button>
          {rewards.length > 0 && (
            <button
              onClick={() => goKidView('shop')}
              className={cn(
                "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all text-xs font-semibold uppercase tracking-wider whitespace-nowrap",
                kidView === 'shop' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              🛍 Shop
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pr-1">
          <button
            onClick={() => setShowHistory(true)}
            className={cn("p-2.5 min-h-[44px] min-w-[44px] flex justify-center items-center rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold", isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")}
          >
            <History className="w-4 h-4" />
          </button>
          {kidView === 'tasks' && (
            <button
              onClick={() => setShowFilters(f => !f)}
              className={cn(
                "p-2.5 min-h-[44px] min-w-[44px] flex justify-center items-center rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold border",
                showFilters
                  ? (isDarkMode ? "bg-ui-dark-2 text-white border-ui-dark-3" : "bg-white text-ui-primary shadow-sm border-ui")
                  : (isDarkMode ? "text-ui-secondary border-transparent hover:text-white" : "text-ui-muted border-transparent hover:text-ui-secondary")
              )}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible sort + filter — only visible when toggled */}
      <AnimatePresence>
        {kidView === 'tasks' && showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 flex-wrap pt-1">
              <div className={cn("flex gap-1 p-1 rounded-2xl", currentTheme.vocab?.darkMode ? "bg-ui-dark-30" : "bg-ui-soft")}>
                <button
                  onClick={() => setSortBy('time')}
                  className={cn(
                    "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all flex items-center gap-2 text-xs font-semibold",
                    sortBy === 'time' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
                  )}
                >
                  <Clock className="w-3.5 h-3.5" /> Time
                </button>
                <button
                  onClick={() => setSortBy('created')}
                  className={cn(
                    "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all flex items-center gap-2 text-xs font-semibold",
                    sortBy === 'created' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
                  )}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Newest
                </button>
              </div>
              <div className={cn("flex gap-1 p-1 rounded-2xl", currentTheme.vocab?.darkMode ? "bg-ui-dark-30" : "bg-ui-soft")}>
                <button
                  onClick={() => setTaskView('all')}
                  className={cn(
                    "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                    taskView === 'all' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setTaskView('upforgrabs')}
                  className={cn(
                    "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                    taskView === 'upforgrabs' ? (isDarkMode ? "bg-fuchsia-800 text-white" : "bg-fuchsia-100 text-fuchsia-800 shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
                  )}
                >
                  Up for Grabs
                </button>
                <button
                  onClick={() => setTaskView('assigned')}
                  className={cn(
                    "p-2.5 px-4 min-h-[44px] flex items-center rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                    taskView === 'assigned' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
                  )}
                >
                  Assigned
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasks — immediately visible */}
      {kidView === 'tasks' && (
        <KidTaskBoard
          sections={taskSections}
          taskView={taskView}
          filteredTasksLength={filteredTasks.length}
          isDarkMode={isDarkMode}
          panelBgClass={currentTheme.vocab?.panelBg}
          panelBorderClass={currentTheme.vocab?.panelBorder}
          noTasksText={currentTheme.vocab?.noTasks || "No chores right now. You're all caught up!"}
          categories={categories}
          themeVocab={currentTheme.vocab}
          getUrgency={getUrgency}
          isTaskLocked={isTaskLocked}
          isCompleted={isCompleted}
          isTaskPending={isTaskPending}
          getCompletion={getCompletion}
          onToggleTask={(taskId, currentStatus, count) => void toggleTask(taskId, currentStatus, count, isTaskLocked)}
          onSkipTask={skipTask}
        />
      )}
      {kidView === 'tasks' && tasks.length > 0 && (
        <div className={cn("rounded-2xl p-4 border shadow-sm", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-ui")}>
          <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">This Week</h3>
          <WeeklyChoreGrid tasks={tasks} kids={[profile]} completions={completions} compact />
        </div>
      )}
      {kidView === 'tasks' && (
        <FamilyNote parentId={profile.parentId || profile.uid} readOnly={true} />
      )}

      {kidView === 'calendar' && (
        <Suspense fallback={<div className="py-10 text-sm text-ui-muted">Loading calendar...</div>}>
          <CalendarView
            parentId={profile.parentId || profile.uid}
            kids={kids}
            memberColorMap={memberColorMap}
            isLocked={true}
            userRole="kid"
          />
        </Suspense>
      )}
      {kidView === 'homework' && (
        <Suspense fallback={<div className="py-10 text-sm text-ui-muted">Loading homework...</div>}>
          <HomeworkView
            parentId={profile.parentId || profile.uid}
            kids={kids}
            userRole="kid"
            currentUserId={profile.uid}
          />
        </Suspense>
      )}
      {kidView === 'shop' && (
        <div className={cn("p-6 rounded-3xl sm:rounded-[3rem] border", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-ui")}>
          <h3 className={cn("text-2xl font-bold mb-6", `text-${currentTheme.primary}`)}>{currentTheme.vocab?.rewards || 'Rewards Shop'}</h3>
          <RewardsShop
            rewards={rewards}
            claimedRewards={claimedRewards}
            kidXP={localXp}
            kidStars={availableStars}
            onClaim={(rewardId, xpCost) => void claimReward(rewardId, xpCost)}
          />
        </div>
      )}

      {progressPercent === 100 && totalSlots > 0 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn("p-8 rounded-3xl sm:rounded-[3rem] text-center shadow-sm", currentTheme.vocab?.darkMode ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-emerald-50 border border-emerald-100")}
        >
          <Award className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className={cn("text-2xl font-bold mb-2", currentTheme.vocab?.darkMode ? "text-emerald-400" : "text-emerald-700")}>{currentTheme.vocab?.allDone || 'All Done!'}</h3>
          <p className={cn("font-bold uppercase text-xs tracking-widest", currentTheme.vocab?.darkMode ? "text-emerald-500" : "text-emerald-600")}>{currentTheme.vocab?.allDoneDesc || 'Great Job Today'}</p>
        </motion.div>
      )}

      {tasks.some((t: Task) => getUrgency(t) === 'overdue') && (
        <div className={cn("flex items-center gap-4 p-4 rounded-2xl shadow-sm", currentTheme.vocab?.darkMode ? "bg-rose-500/10 border border-rose-500/30" : "bg-red-50 border border-red-100")}>
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", currentTheme.vocab?.darkMode ? "bg-rose-500/20 text-rose-500" : "bg-red-100 text-red-500")}>
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className={cn("font-bold text-sm tracking-wide", currentTheme.vocab?.darkMode ? "text-rose-400" : "text-red-700")}>{currentTheme.vocab?.overdue || 'Tasks Overdue'}</p>
            <p className={cn("text-xs", currentTheme.vocab?.darkMode ? "text-rose-500/80" : "text-red-500")}>{currentTheme.vocab?.overdueDesc || 'Some chores need your attention right now.'}</p>
          </div>
        </div>
      )}

      <BadgeCollection
        profile={profile}
        isDarkMode={isDarkMode}
        toneSecondary={toneSecondary}
        themeVocab={currentTheme.vocab}
      />

      <AnimatePresence>
        {showHistory && (
          <MissionHistoryModal
            profile={profile}
            tasks={tasks}
            categories={categories}
            onClose={() => setShowHistory(false)}
          />
        )}
        {showThemeSelector && (
          <ThemeSelectorModal
            currentThemeId={profile.themeId || 'space'}
            onSelect={handleThemeSelect}
            onClose={() => setShowThemeSelector(false)}
          />
        )}
        {editingAvatar && (
          <div className="fixed inset-0 bg-ui-deep-80 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-80">
              <h3 className="font-semibold mb-3 text-ui-primary">My Avatar</h3>
              <AvatarPicker
                uid={profile.uid}
                current={{ ...profile, ...localAvatar, name: profile.name }}
                onUpdated={(preset, url) => {
                  setLocalAvatar({ preset: preset ?? undefined, url: url ?? undefined });
                  setEditingAvatar(false);
                }}
              />
              <button onClick={() => setEditingAvatar(false)} className="mt-3 text-sm text-ui-muted">Cancel</button>
            </div>
          </div>
        )}
      </AnimatePresence>

      <CelebrationOverlays
        confirmTask={confirmTask}
        setConfirmTask={setConfirmTask}
        proofAnswers={proofAnswers}
        setProofAnswers={setProofAnswers}
        executeCompletion={executeCompletion}
        xpAnimation={xpAnimation}
        showStarBurst={showStarBurst}
        starsAwarded={starsAwarded}
        celebrationTick={celebrationTick}
        unlockedBadge={unlockedBadge}
        dismissUnlockedBadge={dismissUnlockedBadge}
        currentTheme={currentTheme}
        toneSecondary={toneSecondary}
      />
    </div>
  );
}
