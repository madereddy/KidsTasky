import { userService } from '../../services/users';
import { tasksClientService } from '../../services/tasks';
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Settings, Flame, Trophy, Zap, TrendingUp, Award, Clock, CalendarDays, History, Bell, Star, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfToday, subDays } from 'date-fns';
import { Task, TaskCompletion, UserProfile, Category, BadgeDef } from '../../types';
import { cn } from '../../lib/utils';
import { THEMES, XP_REWARDS, BADGE_DEFS } from '../../constants';
import { xpProgress } from '../../lib/xp';
import { KidTaskBoard } from './KidTaskBoard';
import { MissionHistoryModal } from './MissionHistoryModal';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { useSocketStaleData } from '../../hooks/useSocket';
import { AvatarDisplay, AvatarPicker } from '../shared/AvatarPicker';
import { FamilyNote } from '../shared/FamilyNote';
import { WeeklyChoreGrid } from '../shared/WeeklyChoreGrid';
import { RewardsShop } from './RewardsShop';
import { useTaskCompletionController } from '../../hooks/useTaskCompletionController';
import { useKidProgress } from '../../hooks/useKidProgress';
import { useKidMilestones } from '../../hooks/useKidMilestones';
import { useKidRewardsController } from '../../hooks/useKidRewardsController';
import { KidDashboardSkeleton } from '../shared/Skeleton';
const CalendarView = lazy(() => import('../calendar/CalendarView').then(m => ({ default: m.CalendarView })));
const HomeworkView = lazy(() => import('../homework/HomeworkView').then(m => ({ default: m.HomeworkView })));

export function KidDashboard({ 
  profile, 
  onProgressChange, 
  categories,
  selectedCategoryId,
  onProfileUpdate,
  kids,
  memberColorMap
}: { 
  profile: UserProfile, 
  onProgressChange: (p: number) => void,
  categories: Category[],
  selectedCategoryId: string | null,
  onProfileUpdate: () => void,
  kids: UserProfile[],
  memberColorMap: Record<string, string>
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(startOfToday(), 'yyyy-MM-dd');
  const [sortBy, setSortBy] = useState<'time' | 'created'>('time');
  const [kidView, setKidView] = useState<'tasks' | 'calendar' | 'homework' | 'shop'>('tasks');
  const [taskView, setTaskView] = useState<'all' | 'upforgrabs' | 'assigned'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<{ preset?: string; url?: string }>({
    preset: profile.avatarPreset,
    url: profile.avatarUrl,
  });

  const currentTheme = THEMES.find(t => t.id === profile.themeId) || THEMES[0];
  const isDarkMode = !!currentTheme.vocab?.darkMode;
  const toneSecondary = currentTheme.vocab?.textSecondary || (isDarkMode ? "text-ui-muted-2" : "text-ui-muted");

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
      });
    } catch (e) {
      console.error("Failed to fetch kid dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, [profile.uid, today, loadRewards]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSocketStaleData(['tasks', 'completions', 'rewards', 'users'], (data) => {
    fetchData();
    const signal = data.type || data.entity;
    if (signal === 'rewards' || signal === 'users') {
      loadRewards().catch((e) => console.error('Failed refreshing rewards:', e));
    }
  });
  const {
    completions,
    setCompletions,
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
    shouldShowToday,
    filteredTasks,
    todayTasks,
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // RuneScape-style level/progress derived from current XP (not the stored,
  // possibly-stale level column). Harder to level the higher you climb.
  const xpStats = xpProgress(localXp);

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
    <div className="space-y-8">
      <style>{`
        body {
          background-image: ${currentTheme.bg} !important;
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cn(
          "md:col-span-2 shadow-sm p-6 rounded-[2rem] border flex justify-between items-center relative overflow-hidden",
          currentTheme.vocab?.panelBg || "bg-white",
          currentTheme.vocab?.panelBorder || "border-ui-soft"
        )}>
          <div className="relative z-10">
            <h3 className={cn("text-2xl font-bold mb-1", currentTheme.vocab?.textPrimary || "text-ui-primary")}>{currentTheme.vocab?.chores || 'My Chores'}</h3>
            <p className={cn("text-sm font-medium", toneSecondary)}>{currentTheme.vocab?.level || 'Level'} {xpStats.level}</p>
          </div>
          <div className="flex gap-4 items-center relative z-10">
            <button onClick={() => setEditingAvatar(true)}>
              <AvatarDisplay
                avatarPreset={localAvatar.preset ?? profile.avatarPreset}
                avatarUrl={localAvatar.url ?? profile.avatarUrl}
                name={profile.name}
                size={48}
              />
            </button>
            <button 
              onClick={() => setShowThemeSelector(true)}
              aria-label="Open theme settings"
              className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors border", currentTheme.vocab?.darkMode ? "bg-ui-dark-2 border-ui-dark-2 text-ui-muted-2 hover:text-white" : "bg-ui-soft border-ui-soft text-ui-muted-2 hover:text-ui-primary hover:bg-ui-soft-2")}
            >
              <Settings className="w-6 h-6" />
            </button>
            <div className="text-right ml-4">
              <p className={cn("text-xs uppercase font-bold", toneSecondary)}>{currentTheme.vocab?.streak || 'Streak'}</p>
              <p className={cn("text-3xl font-black leading-none", `text-${currentTheme.primary}`)}>{streak}</p>
            </div>
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all",
              streak > 0 ? `bg-${currentTheme.primary}/20 text-${currentTheme.primary}` : "bg-ui-soft text-ui-muted-2"
            )}>
              <Flame className={cn("w-8 h-8", streak > 0 && `fill-${currentTheme.primary}`)} />
            </div>
          </div>
        </div>

        <div className={cn(
          "shadow-sm p-6 rounded-[2rem] border flex flex-col justify-center relative overflow-hidden group",
          currentTheme.vocab?.panelBg || "bg-white",
          currentTheme.vocab?.panelBorder || "border-ui-soft"
        )}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className={cn("text-xs uppercase font-bold mb-1", toneSecondary)}>Progress</p>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-3xl font-black leading-none", currentTheme.vocab?.textPrimary || "text-ui-primary")}>{xpStats.xpIntoLevel}</span>
                <span className={cn("text-sm font-bold uppercase", isDarkMode ? "text-ui-muted-2" : "text-ui-muted-2")}>/ {xpStats.xpForLevelSpan} {currentTheme.vocab?.points || 'XP'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 text-lg">⭐</span>
                <span className={cn("font-bold text-lg", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                  {availableStars}
                </span>
                <span className={cn("text-xs", isDarkMode ? "text-ui-muted-2" : "text-ui-muted-2")}>stars</span>
              </div>
              <div className="text-right">
                <p className={cn("text-[10px] uppercase font-bold mb-1", isDarkMode ? "text-ui-muted-2" : "text-ui-muted-2")}>Total</p>
                <p className={cn("text-base font-bold leading-none", currentTheme.vocab?.textPrimary || "text-ui-primary")}>{localXp} {currentTheme.vocab?.points || 'XP'}</p>
              </div>
            </div>
          </div>
          
          <div className="w-full h-6 bg-ui-soft-2 rounded-full overflow-hidden mb-3 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${xpStats.percent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn("h-full rounded-full relative", `bg-${currentTheme.primary}`)}
            >
            </motion.div>
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <p className={cn("text-xs font-bold flex items-center gap-1", toneSecondary)}>
              <TrendingUp className="w-4 h-4" /> {xpStats.xpToNext} {currentTheme.vocab?.points || 'XP'} to Next {currentTheme.vocab?.level || 'Level'}
            </p>
          </div>
        </div>
      </div>
      <FamilyNote parentId={profile.parentId || profile.uid} readOnly={true} />

      <div className={cn("flex justify-between items-center shadow-sm p-3 rounded-[2rem] border", currentTheme.vocab?.panelBg || "bg-white", currentTheme.vocab?.panelBorder || "border-ui-soft")}>
        <div className="flex gap-2 items-center">
          <div className={cn("flex gap-1 p-1 rounded-2xl", currentTheme.vocab?.darkMode ? "bg-ui-dark-30" : "bg-ui-soft")}>
            <button
              onClick={() => setKidView('tasks')}
              className={cn(
                "p-3 px-4 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                kidView === 'tasks' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              {currentTheme.vocab?.hub || 'My Chores'}
            </button>
            <button
              onClick={() => setKidView('calendar')}
              className={cn(
                "p-3 px-4 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5",
                kidView === 'calendar' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              <CalendarDays className="w-4 h-4" /> Calendar
            </button>
            <button
              onClick={() => setKidView('homework')}
              className={cn(
                "p-3 px-4 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                kidView === 'homework' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              Homework
            </button>
            {rewards.length > 0 && (
              <button
                onClick={() => setKidView('shop')}
                className={cn(
                  "p-3 px-4 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider flex items-center gap-1",
                  kidView === 'shop' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
                )}
              >
                🛍 Shop
              </button>
            )}
          </div>
          <div className={cn("flex gap-1 p-1 rounded-2xl", currentTheme.vocab?.darkMode ? "bg-ui-dark-30" : "bg-ui-soft")}>
            <button 
              onClick={() => setSortBy('time')}
              className={cn(
                "p-3 px-5 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold",
                sortBy === 'time' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              <Clock className="w-4 h-4" /> Time
            </button>
            <button 
              onClick={() => setSortBy('created')}
              className={cn(
                "p-3 px-5 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold",
                sortBy === 'created' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              <CalendarDays className="w-4 h-4" /> New
            </button>
          </div>
          <div className={cn("flex gap-1 p-1 rounded-2xl", currentTheme.vocab?.darkMode ? "bg-ui-dark-30" : "bg-ui-soft")}>
            <button
              onClick={() => setTaskView('all')}
              className={cn(
                "p-3 px-4 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                taskView === 'all' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              All
            </button>
            <button
              onClick={() => setTaskView('upforgrabs')}
              className={cn(
                "p-3 px-4 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                taskView === 'upforgrabs' ? (isDarkMode ? "bg-fuchsia-800 text-white" : "bg-fuchsia-100 text-fuchsia-800 shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              Up for Grabs
            </button>
            <button
              onClick={() => setTaskView('assigned')}
              className={cn(
                "p-3 px-4 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                taskView === 'assigned' ? (isDarkMode ? "bg-ui-dark-2 text-white" : "bg-white text-ui-primary shadow-sm") : (isDarkMode ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-secondary")
              )}
            >
              Assigned
            </button>
          </div>
        </div>

        <button 
          onClick={() => setShowHistory(true)}
          className={cn(
            "p-3 px-6 rounded-xl transition-all flex items-center gap-2 text-sm font-bold bg-ui-soft-2 text-ui-secondary hover:bg-ui-soft-3"
          )}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

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

      {kidView === 'tasks' && tasks.length > 0 && (
        <div className={cn("rounded-2xl p-4 border shadow-sm mb-4", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-ui")}>
          <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">This Week</h3>
          <WeeklyChoreGrid tasks={tasks} kids={[profile]} completions={completions} compact />
        </div>
      )}
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
      {kidView === 'tasks' && (
        <Suspense fallback={<div className="py-10 text-sm text-ui-muted">Loading homework...</div>}>
          <HomeworkView
            parentId={profile.parentId || profile.uid}
            kids={kids}
            userRole="kid"
            currentUserId={profile.uid}
          />
        </Suspense>
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
        <div className={cn("p-6 rounded-[3rem] border", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-ui")}>
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
          className={cn("p-8 rounded-[3rem] text-center shadow-sm", currentTheme.vocab?.darkMode ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-emerald-50 border border-emerald-100")}
        >
          <Award className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className={cn("text-2xl font-bold mb-2", currentTheme.vocab?.darkMode ? "text-emerald-400" : "text-emerald-700")}>{currentTheme.vocab?.allDone || 'All Done!'}</h3>
          <p className={cn("font-bold uppercase text-xs tracking-widest", currentTheme.vocab?.darkMode ? "text-emerald-500" : "text-emerald-600")}>{currentTheme.vocab?.allDoneDesc || 'Great Job Today'}</p>
        </motion.div>
      )}

      {/* Alert Banner / Notification */}
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

      {/* Badge Collection Section */}
      <div className="space-y-4 pt-8">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-amber-500" />
          <h3 className={cn("text-2xl font-bold", currentTheme.vocab?.textPrimary || "text-ui-primary")}>{currentTheme.vocab?.badges || 'My Badges'}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.values(BADGE_DEFS).map(badge => {
            const isEarned = (profile.badges || []).some(b => b.id === badge.id);
            return (
              <motion.div 
                key={badge.id}
                whileHover={isEarned ? { scale: 1.02 } : {}}
                className={cn(
                  "p-5 rounded-[2rem] border flex flex-col items-center justify-center text-center gap-3 transition-all relative overflow-hidden",
                  isEarned ? cn(badge.color, "bg-opacity-10 border-transparent shadow-sm") : "bg-ui-soft border-ui-soft opacity-60 grayscale"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-1 shadow-sm",
                  isEarned ? "bg-white" : "bg-ui-soft-2"
                )}>
                  {badge.icon}
                </div>
                <div>
                  <p className={cn("font-bold text-sm leading-tight", isEarned ? (isDarkMode ? "text-ui-primary" : "text-ui-primary") : (isDarkMode ? "text-ui-muted-2" : "text-ui-muted"))}>
                    {badge.name}
                  </p>
                  <p className={cn("text-xs mt-1 leading-tight px-1", toneSecondary)}>{badge.description}</p>
                </div>
                {isEarned && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-3 right-3"
                  >
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {confirmTask && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-ui-dark-40 backdrop-blur-sm"
          >
            <div className={cn("border rounded-[3rem] p-8 shadow-xl max-w-sm w-full text-center relative overflow-hidden", currentTheme.vocab?.panelBg || "bg-white", currentTheme.vocab?.panelBorder || "border-ui-soft")}>
              <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10", `bg-${currentTheme.primary}/10`)}>
                <CheckCircle2 className={cn("w-10 h-10", `text-${currentTheme.primary}`)} />
              </div>
              <h4 className={cn("text-3xl font-bold mb-2 relative z-10", currentTheme.vocab?.textPrimary || "text-ui-primary")}>{currentTheme.vocab?.verifyTitle || 'All Done?'}</h4>
              <p className={cn("mb-8 relative z-10 text-sm font-medium", currentTheme.vocab?.textSecondary || "text-ui-muted")}>
                {currentTheme.vocab?.verifyDesc || 'Did you complete'}<br/><span className={cn("text-lg font-bold", currentTheme.vocab?.textPrimary || "text-ui-primary")}>"{confirmTask.taskTitle}"</span>?
              </p>

              {(confirmTask.questions || []).length > 0 && (
                <div className="mb-6 text-left space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-ui-muted">Follow-up Questions</p>
                  {confirmTask.questions!.map((q, i) => (
                    <div key={`proof-${i}`}>
                      <label className="block text-xs text-ui-muted mb-1">{q}</label>
                      <input
                        className="w-full border border-ui rounded-xl px-3 py-2 text-sm text-ui-primary"
                        value={proofAnswers[`q_${i}`] || ''}
                        onChange={(e) => setProofAnswers((prev) => ({ ...prev, [`q_${i}`]: e.target.value }))}
                        placeholder="Your answer"
                      />
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-4 relative z-10">
                <button 
                  onClick={() => setConfirmTask(null)}
                  className={cn("flex-1 py-4 font-bold rounded-2xl transition-all", currentTheme.vocab?.darkMode ? "bg-ui-dark-2 text-ui-muted-2 hover:bg-ui-dark-2" : "bg-ui-soft-2 text-ui-secondary hover:bg-ui-soft-3")}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeCompletion}
                  disabled={(confirmTask.questions || []).length > 0 && (confirmTask.questions || []).some((_, i) => !String(proofAnswers[`q_${i}`] || '').trim())}
                  className={cn("flex-1 py-4 font-bold rounded-2xl transition-all shadow-md", `bg-${currentTheme.primary} text-white hover:bg-${currentTheme.accent}`)}
                >
                  {currentTheme.vocab?.confirmYes || 'Yes!'} +{confirmTask.xpReward} {currentTheme.vocab?.points || 'XP'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {xpAnimation.active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: [0.5, 1.2, 1], y: -100 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed inset-0 z-[130] pointer-events-none flex items-center justify-center"
          >
            <div className="flex flex-col items-center">
               <motion.div
                 animate={{ rotate: 360 }}
                 transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                 className="text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"
               >
                 <Star className="w-20 h-20 fill-yellow-400" />
               </motion.div>
               <span className="text-6xl font-black text-amber-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] uppercase tracking-tighter italic">
                 +{xpAnimation.amount} XP
               </span>
            </div>
          </motion.div>
        )}

        {showStarBurst && starsAwarded > 0 && (
          <motion.div
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.5, y: -40 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed bottom-1/3 left-1/2 -translate-x-1/2 z-[140] pointer-events-none text-3xl font-black"
          >
            ⭐ +{starsAwarded}
          </motion.div>
        )}

        {celebrationTick > 0 && (
          <div className="fixed inset-0 pointer-events-none z-[129] overflow-hidden" key={`celebrate-${celebrationTick}`}>
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.div
                key={`confetti-${celebrationTick}-${i}`}
                initial={{ opacity: 1, y: 80, x: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -260 - (i % 4) * 30, x: (i % 2 === 0 ? 1 : -1) * (40 + i * 8), rotate: (i % 2 === 0 ? 1 : -1) * (60 + i * 10), scale: 1.1 }}
                transition={{ duration: 1.1, ease: "easeOut", delay: (i % 6) * 0.03 }}
                className="absolute left-1/2 bottom-24 text-2xl"
              >
                {i % 3 === 0 ? '🎉' : (i % 3 === 1 ? '✨' : '⭐')}
              </motion.div>
            ))}
          </div>
        )}
        {unlockedBadge && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-10 left-6 right-6 md:left-auto md:right-10 md:w-80 z-[100] bg-white border border-ui rounded-[3rem] p-8 shadow-xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="text-6xl mb-6">
                {unlockedBadge.icon}
              </div>
              <h4 className="text-2xl font-bold text-sky-500 mb-2">New Badge!</h4>
              <p className="text-ui-primary font-black text-lg leading-tight mb-2">{unlockedBadge.name}</p>
              <p className={cn("text-sm mb-8 leading-relaxed", toneSecondary)}>{unlockedBadge.description}</p>
              <button 
                onClick={dismissUnlockedBadge}
                className="w-full py-4 bg-sky-500 text-white font-bold rounded-2xl hover:bg-sky-400 transition-all active:scale-95"
              >
                Awesome
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


