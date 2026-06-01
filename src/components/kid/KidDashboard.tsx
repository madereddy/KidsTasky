import { userService } from '../../services/users';
import { tasksClientService } from '../../services/tasks';
import { rewardService } from '../../services/rewards';
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Settings, Flame, Trophy, Zap, TrendingUp, Award, Clock, CalendarDays, History, Bell, Star, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfToday, isAfter, parse, addHours, subDays, differenceInDays, startOfDay } from 'date-fns';
import { Task, TaskCompletion, UserProfile, Category, Reward, ClaimedReward, BadgeDef } from '../../types';
import { cn, parseTimestamp } from '../../lib/utils';
import { THEMES, XP_REWARDS, BADGE_DEFS } from '../../constants';
import { KidTaskBoard } from './KidTaskBoard';
import { MissionHistoryModal } from './MissionHistoryModal';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { useSocketStaleData } from '../../hooks/useSocket';
import { AvatarDisplay, AvatarPicker } from '../shared/AvatarPicker';
import { FamilyNote } from '../shared/FamilyNote';
import { WeeklyChoreGrid } from '../shared/WeeklyChoreGrid';
import { RewardsShop } from './RewardsShop';
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
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const today = format(startOfToday(), 'yyyy-MM-dd');
  const [unlockedBadge, setUnlockedBadge] = useState<BadgeDef | null>(null);
  const [sortBy, setSortBy] = useState<'time' | 'created'>('time');
  const [kidView, setKidView] = useState<'tasks' | 'calendar' | 'homework' | 'shop'>('tasks');
  const [taskView, setTaskView] = useState<'all' | 'upforgrabs' | 'assigned'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<{ preset?: string; url?: string }>({
    preset: profile.avatarPreset,
    url: profile.avatarUrl,
  });
  
  // Task Confirmation & Animation
  const [confirmTask, setConfirmTask] = useState<{
    taskId: string;
    count?: number;
    xpReward: number;
    taskTitle: string;
    questions?: string[];
  } | null>(null);
  const [proofAnswers, setProofAnswers] = useState<Record<string, string>>({});
  const [xpAnimation, setXpAnimation] = useState<{amount: number, active: boolean}>({amount: 0, active: false});
  const [showStarBurst, setShowStarBurst] = useState(false);
  const [starsAwarded, setStarsAwarded] = useState(0);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [localXp, setLocalXp] = useState(profile.xp || 0);

  const currentTheme = THEMES.find(t => t.id === profile.themeId) || THEMES[0];
  const isDarkMode = !!currentTheme.vocab?.darkMode;
  const toneSecondary = currentTheme.vocab?.textSecondary || (isDarkMode ? "text-ui-muted-2" : "text-ui-muted");

  const claimReward = async (rewardId: string, xpCost: number) => {
    try {
      await rewardService.claimReward(profile.uid, rewardId, xpCost);
      setClaimedRewards([...claimedRewards, { id: 'tmp_' + Date.now(), kidId: profile.uid, rewardId, createdAt: Date.now() }]);
      setLocalXp((prev) => Math.max(0, prev - xpCost));
      onProfileUpdate();
    } catch (e) {
      console.error("Failed to claim reward", e);
      alert("Could not claim reward. Please try again.");
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [t, c, r, cr] = await Promise.all([
        tasksClientService.getTasksForKid(profile.uid),
        tasksClientService.getCompletionsForKid(profile.uid, today),
        rewardService.getRewards(profile.parentId!),
        rewardService.getClaimedRewards(profile.uid)
      ]);
      setTasks(t || []);
      setCompletions(c || []);
      setRewards(r || []);
      setClaimedRewards(cr || []);
    } catch (e) {
      console.error("Failed to fetch kid dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, [profile.uid, profile.parentId, today]);

  useSocketStaleData(['tasks', 'completions', 'rewards', 'users'], (data) => {
    fetchData();
  });

  useEffect(() => {
    setLocalXp(profile.xp || 0);
  }, [profile.xp]);

  useEffect(() => {
    const checkMilestones = async () => {
      if (loading) return;
      const earnedIds = (profile.badges || []).map(b => b.id);
      
      // First Mission
      if (!earnedIds.includes('first_mission') && completions.length > 0) {
        await userService.addBadge(profile.uid, 'first_mission');
        setUnlockedBadge(BADGE_DEFS['first_mission']);
        onProfileUpdate();
      }

      // XP 100
      if (!earnedIds.includes('xp_100') && localXp >= 100) {
        await userService.addBadge(profile.uid, 'xp_100');
        setUnlockedBadge(BADGE_DEFS['xp_100']);
        onProfileUpdate();
      }

      // Streak 7
      if (!earnedIds.includes('streak_7') && streak >= 7) {
        await userService.addBadge(profile.uid, 'streak_7');
        setUnlockedBadge(BADGE_DEFS['streak_7']);
        onProfileUpdate();
      }
    };
    checkMilestones();
  }, [completions.length, localXp, streak, loading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const calculateStreak = async () => {
      if (tasks.length === 0) return;
      
      const totalSlots = tasks.reduce((acc: number, task: Task) => acc + (task.frequency === 'twice-daily' ? 2 : 1), 0);
      if (totalSlots === 0) return;

      const startDate = format(subDays(startOfToday(), 30), 'yyyy-MM-dd');
      const histCompletions = await tasksClientService.getCompletionsForDateRange(profile.uid, startDate, today);
      
      let currentStreak = 0;
      let checkDate = startOfToday();
      
      const compsByDate: Record<string, number> = {};
      histCompletions.forEach(hc => {
        compsByDate[hc.dateString] = (compsByDate[hc.dateString] || 0) + 1;
      });

      // Override today with current local state
      compsByDate[today] = completions.length;

      for (let i = 0; i < 30; i++) {
        const ds = format(checkDate, 'yyyy-MM-dd');
        const compsCount = compsByDate[ds] || 0;
        
        if (compsCount >= totalSlots) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
        checkDate = subDays(checkDate, 1);
      }
      setStreak(currentStreak);

      // Milestone Check: Elite Striker (10 Hard completions)
      const earnedIds = (profile.badges || []).map(b => b.id);
      if (!earnedIds.includes('hard_master')) {
        const hardTaskIds = tasks.filter((t: Task) => t.difficulty === 'hard').map(t => t.id);
        const hardCount = histCompletions.filter((hc: TaskCompletion) => hardTaskIds.includes(hc.taskId)).length;
        if (hardCount >= 5) { // Lowering to 5 for easier demo verification
          await userService.addBadge(profile.uid, 'hard_master');
          setUnlockedBadge(BADGE_DEFS['hard_master']);
          onProfileUpdate();
        }
      }
    };

    calculateStreak();
  }, [tasks, completions, profile.uid, today]);

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

  const completeTaskNow = async (taskId: string, count: number | undefined, xpReward: number, questions: string[], answers: Record<string, string>) => {
    const task = tasks.find(t => t.id === taskId);
    const stars = task?.starValue ?? 1;
    setXpAnimation({ amount: xpReward, active: true });
    setStarsAwarded(stars);
    setShowStarBurst(true);
    setTimeout(() => setShowStarBurst(false), 1200);
    try {
      const proofPayload = questions
        .map((question, i) => ({ question, answer: String(answers[`q_${i}`] || '').trim() }))
        .filter((entry) => entry.answer.length > 0);
      await tasksClientService.completeTask(taskId, profile.uid, today, count, proofPayload.length > 0 ? proofPayload : undefined);
      try {
        await userService.updateUserXP(profile.uid, xpReward);
      } catch (xpError) {
        console.warn("Task completed but XP update failed", xpError);
      }
      setCompletions([...completions, {
        id: `${taskId}_${today}_${count || 1}`,
        taskId,
        kidId: profile.uid,
        completedAt: { seconds: Date.now()/1000 },
        dateString: today,
        count
      }]);
      setLocalXp((prev) => prev + xpReward);
      setCelebrationTick((n) => n + 1);
      onProfileUpdate();
    } catch (e) {
      console.error("Failed to complete task", e);
      setXpAnimation({ amount: 0, active: false });
      alert("Could not save completion. Please try again.");
    }
    setTimeout(() => {
      setXpAnimation({ amount: 0, active: false });
    }, 2500);
  };

  const toggleTask = async (taskId: string, currentStatus: boolean, count?: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (isTaskLocked(task) && !currentStatus) return; // Prevent completion if locked

    const xpReward = XP_REWARDS[task.difficulty || 'easy'];

    if (currentStatus) {
      await tasksClientService.uncompleteTask(taskId, today, count);
      await userService.updateUserXP(profile.uid, -xpReward);
      setCompletions(completions.filter((c: TaskCompletion) => !(c.taskId === taskId && c.count === count)));
      setLocalXp((prev) => Math.max(0, prev - xpReward));
      onProfileUpdate();
    } else {
      const questions = Array.isArray(task.completionQuestions) ? task.completionQuestions.filter(Boolean) : [];
      const scopedQuestions = (!task.completionQuestionsKidId || task.completionQuestionsKidId === profile.uid) ? questions : [];
      if (scopedQuestions.length === 0) {
        await completeTaskNow(taskId, count, xpReward, [], {});
        return;
      }
      setProofAnswers({});
      setConfirmTask({ taskId, count, xpReward, taskTitle: task.title, questions: scopedQuestions });
    }
  };

  const skipTask = async (taskId: string, count?: number) => {
    try {
      await tasksClientService.skipTask(taskId, profile.uid, today, count);
      setCompletions([...completions, {
        id: `${taskId}_${today}_${count || 1}`,
        taskId,
        kidId: profile.uid,
        completedAt: { seconds: Date.now() / 1000 },
        dateString: today,
        count,
        approvalStatus: 'skipped'
      }]);
    } catch (e) {
      console.error("Failed to skip task", e);
      alert("Could not skip task. Please try again.");
    }
  };

  const executeCompletion = async () => {
    if (!confirmTask) return;
    const { taskId, count, xpReward, questions = [] } = confirmTask;
    setConfirmTask(null);
    await completeTaskNow(taskId, count, xpReward, questions, proofAnswers);
  };

    const getCompletion = (taskId: string, count?: number) => {
    return completions.find((c: TaskCompletion) => c.taskId === taskId && c.count === count);
    };

    const isCompleted = (taskId: string, count?: number) => {
    return completions.some((c: TaskCompletion) => c.taskId === taskId && c.count === count);
    };

    const shouldShowToday = (task: Task) => {
    if (task.frequency === 'daily' || task.frequency === 'twice-daily') return true;
    if (task.frequency === 'weekdays') {
      const day = new Date().getDay();
      return day >= 1 && day <= 5;
    }
    
    // For weekly, bi-weekly, custom
    const createdDate = parseTimestamp(task.createdAt);
    const daysSinceCreated = differenceInDays(startOfToday(), startOfDay(createdDate));
    
    if (task.frequency === 'weekly') return daysSinceCreated % 7 === 0;
    if (task.frequency === 'bi-weekly') return daysSinceCreated % 14 === 0;
    if (task.frequency === 'custom' && task.customInterval) return daysSinceCreated % task.customInterval === 0;
    
    return false;
  };

  const filteredTasks = (selectedCategoryId 
    ? tasks.filter((t: Task) => t.categoryId === selectedCategoryId && shouldShowToday(t))
    : tasks.filter((t: Task) => shouldShowToday(t))).sort((a: Task, b: Task) => {
      if (sortBy === 'time') {
        const timeA = a.reminderTime || '99:99';
        const timeB = b.reminderTime || '99:99';
        return timeA.localeCompare(timeB);
      }
      return parseTimestamp(b.createdAt).getTime() - parseTimestamp(a.createdAt).getTime();
    });
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

  const todayTasks = tasks.filter((t: Task) => shouldShowToday(t));
  const totalSlots = todayTasks.reduce((acc: number, t: Task) => acc + (t.frequency === 'twice-daily' ? 2 : 1), 0);
  const todayCompletions = completions.filter(c => c.dateString === today);
  const progressPercent = totalSlots > 0 ? (todayCompletions.length / totalSlots) * 100 : 0;

  useEffect(() => {
    onProgressChange(progressPercent);
  }, [progressPercent, onProgressChange]);

  const getUrgency = (task: Task) => {
    if (!task.reminderTime || isCompleted(task.id)) return 'none';
    const now = new Date();
    const reminder = parse(task.reminderTime, 'HH:mm', now);
    if (isAfter(now, reminder)) return 'overdue';
    if (isAfter(now, addHours(reminder, -1))) return 'soon';
    return 'none';
  };

  const handleThemeSelect = async (themeId: string) => {
    await userService.updateUserTheme(profile.uid, themeId);
    onProfileUpdate();
  };

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
            <p className={cn("text-sm font-medium", toneSecondary)}>{currentTheme.vocab?.level || 'Level'} {profile.level || 1}</p>
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
                <span className={cn("text-3xl font-black leading-none", currentTheme.vocab?.textPrimary || "text-ui-primary")}>{localXp % 100}</span>
                <span className={cn("text-sm font-bold uppercase", isDarkMode ? "text-ui-muted-2" : "text-ui-muted-2")}>/ 100 {currentTheme.vocab?.points || 'XP'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 text-lg">⭐</span>
                <span className={cn("font-bold text-lg", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                  {Math.max(0, (profile.earnedStars ?? 0) - (profile.spentStars ?? 0))}
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
              animate={{ width: `${localXp % 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn("h-full rounded-full relative", `bg-${currentTheme.primary}`)}
            >
            </motion.div>
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <p className={cn("text-xs font-bold flex items-center gap-1", toneSecondary)}>
              <TrendingUp className="w-4 h-4" /> {100 - (localXp % 100)} {currentTheme.vocab?.points || 'XP'} to Next {currentTheme.vocab?.level || 'Level'}
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
          getCompletion={getCompletion}
          onToggleTask={toggleTask}
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
            kidXP={profile.xp ?? 0}
            kidStars={Math.max(0, (profile.earnedStars ?? 0) - (profile.spentStars ?? 0))}
            onClaim={(rewardId, xpCost) => claimReward(rewardId, xpCost)}
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
                onClick={() => setUnlockedBadge(null)}
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


