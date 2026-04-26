import { userService } from '../../services/users';
import { tasksClientService } from '../../services/tasks';
import { rewardService } from '../../services/rewards';
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Flame, Trophy, Zap, TrendingUp, Award, Clock, CalendarDays, History, Bell, Star, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfToday, isAfter, parse, addHours, subDays, differenceInDays, startOfDay } from 'date-fns';
import { Task, TaskCompletion, UserProfile, Category, Reward, ClaimedReward, BadgeDef } from '../../types';
import { cn, parseTimestamp } from '../../lib/utils';
import { THEMES, XP_REWARDS, BADGE_DEFS } from '../../constants';
import { TaskCard } from './TaskCard';
import { MissionHistoryModal } from './MissionHistoryModal';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { useSocketStaleData } from '../../hooks/useSocket';

export function KidDashboard({ 
  profile, 
  onProgressChange, 
  categories,
  selectedCategoryId,
  onProfileUpdate
}: { 
  profile: UserProfile, 
  onProgressChange: (p: number) => void,
  categories: Category[],
  selectedCategoryId: string | null,
  onProfileUpdate: () => void
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const today = format(startOfToday(), 'yyyy-MM-dd');
  const [unlockedBadge, setUnlockedBadge] = useState<BadgeDef | null>(null);
  const [sortBy, setSortBy] = useState<'time' | 'created'>('time');
  const [showHistory, setShowHistory] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);
  
  // Task Confirmation & Animation
  const [confirmTask, setConfirmTask] = useState<{taskId: string, count?: number, xpReward: number, taskTitle: string} | null>(null);
  const [xpAnimation, setXpAnimation] = useState<{amount: number, active: boolean}>({amount: 0, active: false});

  const currentTheme = THEMES.find(t => t.id === profile.themeId) || THEMES[0];

  const claimReward = async (rewardId: string, xpCost: number) => {
    await rewardService.claimReward(profile.uid, rewardId, xpCost);
    setClaimedRewards([...claimedRewards, { id: 'tmp_' + Date.now(), kidId: profile.uid, rewardId, createdAt: Date.now() }]);
    onProfileUpdate();
  };

  const fetchData = useCallback(async () => {
    const [t, c, r, cr] = await Promise.all([
      tasksClientService.getTasksForKid(profile.uid),
      tasksClientService.getCompletionsForKid(profile.uid, today),
      rewardService.getRewards(profile.parentId!),
      rewardService.getClaimedRewards(profile.uid)
    ]);
    setTasks(t);
    setCompletions(c);
    setRewards(r);
    setClaimedRewards(cr);
    setLoading(false);
  }, [profile.uid, profile.parentId, today]);

  useSocketStaleData((data) => {
    fetchData();
  });

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
      if (!earnedIds.includes('xp_100') && (profile.xp || 0) >= 100) {
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
  }, [completions.length, profile.xp, streak, loading]);

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

  const toggleTask = async (taskId: string, currentStatus: boolean, count?: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (isTaskLocked(task) && !currentStatus) return; // Prevent completion if locked

    const xpReward = XP_REWARDS[task.difficulty || 'easy'];

    if (currentStatus) {
      await tasksClientService.uncompleteTask(taskId, today, count);
      await userService.updateUserXP(profile.uid, -xpReward);
      setCompletions(completions.filter((c: TaskCompletion) => !(c.taskId === taskId && c.count === count)));
      onProfileUpdate();
    } else {
      setConfirmTask({ taskId, count, xpReward, taskTitle: task.title });
    }
  };

  const executeCompletion = async () => {
    if (!confirmTask) return;
    const { taskId, count, xpReward } = confirmTask;
    setConfirmTask(null);
    setXpAnimation({ amount: xpReward, active: true });
    
    await tasksClientService.completeTask(taskId, profile.uid, today, count);
    await userService.updateUserXP(profile.uid, xpReward);
    setCompletions([...completions, { 
      id: `${taskId}_${today}_${count || 1}`, 
      taskId, 
      kidId: profile.uid, 
      completedAt: { seconds: Date.now()/1000 }, 
      dateString: today, 
      count 
    }]);
    onProfileUpdate();
    setTimeout(() => {
      setXpAnimation({ amount: 0, active: false });
    }, 2500);
  };

  const isCompleted = (taskId: string, count?: number) => {
    return completions.some((c: TaskCompletion) => c.taskId === taskId && c.count === count);
  };

  const shouldShowToday = (task: Task) => {
    if (task.frequency === 'daily' || task.frequency === 'twice-daily') return true;
    
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

  const totalSlots = tasks.reduce((acc: number, t: Task) => acc + (t.frequency === 'twice-daily' ? 2 : 1), 0);
  const progressPercent = totalSlots > 0 ? (completions.length / totalSlots) * 100 : 0;

  useEffect(() => {
    onProgressChange(progressPercent);
  }, [progressPercent, onProgressChange]);

  if (loading) return null;

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
          currentTheme.vocab?.panelBorder || "border-slate-100"
        )}>
          <div className="relative z-10">
            <h3 className={cn("text-2xl font-bold mb-1", currentTheme.vocab?.textPrimary || "text-slate-800")}>{currentTheme.vocab?.chores || 'My Chores'}</h3>
            <p className="text-sm text-slate-500 font-medium">{currentTheme.vocab?.level || 'Level'} {profile.level || 1}</p>
          </div>
          <div className="flex gap-4 items-center relative z-10">
            <button 
              onClick={() => setShowThemeSelector(true)}
              className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors border", currentTheme.vocab?.darkMode ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-800 hover:bg-slate-100")}
            >
              <Settings className="w-6 h-6" />
            </button>
            <div className="text-right ml-4">
              <p className="text-xs text-slate-500 uppercase font-bold">{currentTheme.vocab?.streak || 'Streak'}</p>
              <p className={cn("text-3xl font-black leading-none", `text-${currentTheme.primary}`)}>{streak}</p>
            </div>
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all",
              streak > 0 ? `bg-${currentTheme.primary}/20 text-${currentTheme.primary}` : "bg-slate-50 text-slate-300"
            )}>
              <Flame className={cn("w-8 h-8", streak > 0 && `fill-${currentTheme.primary}`)} />
            </div>
          </div>
        </div>

        <div className={cn(
          "shadow-sm p-6 rounded-[2rem] border flex flex-col justify-center relative overflow-hidden group",
          currentTheme.vocab?.panelBg || "bg-white",
          currentTheme.vocab?.panelBorder || "border-slate-100"
        )}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Progress</p>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-3xl font-black leading-none", currentTheme.vocab?.textPrimary || "text-slate-800")}>{(profile.xp || 0) % 100}</span>
                <span className="text-sm font-bold text-slate-400 uppercase">/ 100 {currentTheme.vocab?.points || 'XP'}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Total</p>
              <p className={cn("text-base font-bold leading-none", currentTheme.vocab?.textPrimary || "text-slate-800")}>{profile.xp || 0} {currentTheme.vocab?.points || 'XP'}</p>
            </div>
          </div>
          
          <div className="w-full h-6 bg-slate-100 rounded-full overflow-hidden mb-3 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(profile.xp || 0) % 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn("h-full rounded-full relative", `bg-${currentTheme.primary}`)}
            >
            </motion.div>
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <p className={cn("text-xs font-bold flex items-center gap-1 text-slate-500")}>
              <TrendingUp className="w-4 h-4" /> {100 - ((profile.xp || 0) % 100)} {currentTheme.vocab?.points || 'XP'} to Next {currentTheme.vocab?.level || 'Level'}
            </p>
          </div>
        </div>
      </div>

      <div className={cn("p-6 rounded-[3rem] border", currentTheme.vocab?.panelBg || "bg-amber-50", currentTheme.vocab?.panelBorder || "border-amber-100")}>
        <h3 className={cn("text-2xl font-bold mb-6", `text-${currentTheme.primary}`)}>{currentTheme.vocab?.rewards || 'Rewards'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rewards.map((r: Reward) => {
            const isClaimed = claimedRewards.some((cr: ClaimedReward) => cr.rewardId === r.id);
            const canAfford = (profile.xp || 0) >= r.xpCost;
            return (
              <div key={r.id} className={cn("p-5 rounded-2xl flex justify-between items-center", currentTheme.vocab?.darkMode ? "bg-black/20" : "bg-white shadow-sm")}>
                 <div>
                   <p className={cn("font-bold text-lg", currentTheme.vocab?.textPrimary || "text-slate-800")}>{r.title}</p>
                   <p className="text-slate-500 text-sm mt-1">{r.description} • <span className={cn("font-bold", `text-${currentTheme.primary}`)}>{r.xpCost} {currentTheme.vocab?.points || 'XP'}</span></p>
                 </div>
                 <button 
                   disabled={isClaimed || !canAfford}
                   onClick={() => claimReward(r.id, r.xpCost)}
                   className={cn("px-6 py-3 rounded-xl text-sm font-bold transition-all", 
                     isClaimed ? "bg-slate-100 text-slate-400" : (canAfford ? `bg-${currentTheme.primary} text-white` : "bg-slate-100 text-slate-400"),
                     !isClaimed && canAfford && `hover:bg-${currentTheme.accent}`
                   )}
                 >
                   {isClaimed ? "Claimed" : (canAfford ? "Claim" : "Not Enough XP")}
                 </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cn("flex justify-between items-center shadow-sm p-3 rounded-[2rem] border", currentTheme.vocab?.panelBg || "bg-white", currentTheme.vocab?.panelBorder || "border-slate-100")}>
        <div className="flex gap-2 items-center">
          <div className={cn("flex gap-1 p-1 rounded-2xl", currentTheme.vocab?.darkMode ? "bg-black/20" : "bg-slate-50")}>
            <button 
              onClick={() => setSortBy('time')}
              className={cn(
                "p-3 px-5 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold",
                sortBy === 'time' ? (currentTheme.vocab?.darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-sm") : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Clock className="w-4 h-4" /> Time
            </button>
            <button 
              onClick={() => setSortBy('created')}
              className={cn(
                "p-3 px-5 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold",
                sortBy === 'created' ? (currentTheme.vocab?.darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-sm") : "text-slate-500 hover:text-slate-700"
              )}
            >
              <CalendarDays className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        <button 
          onClick={() => setShowHistory(true)}
          className={cn(
            "p-3 px-6 rounded-xl transition-all flex items-center gap-2 text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
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
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTasks.map((task: Task) => {
          const urgency = getUrgency(task);
          const category = categories.find(c => c.id === task.categoryId);
          const locked = isTaskLocked(task);
          
          if (task.frequency === 'twice-daily') {
            return (
              <React.Fragment key={task.id}>
                {[1, 2].map(slot => (
                  <TaskCard 
                    key={`${task.id}-${slot}`}
                    task={task}
                    isDone={isCompleted(task.id, slot)}
                    isLocked={locked}
                    onToggle={() => toggleTask(task.id, isCompleted(task.id, slot), slot)}
                    urgency={urgency}
                    slotLabel={slot === 1 ? 'Morning' : 'Evening'}
                    category={category}
                    themeVocab={currentTheme.vocab}
                    darkMode={currentTheme.vocab?.darkMode}
                  />
                ))}
              </React.Fragment>
            );
          }

          return (
            <TaskCard 
              key={task.id}
              task={task}
              isDone={isCompleted(task.id)}
              isLocked={locked}
              onToggle={() => toggleTask(task.id, isCompleted(task.id))}
              urgency={urgency}
              category={category}
              themeVocab={currentTheme.vocab}
              darkMode={currentTheme.vocab?.darkMode}
            />
          );
        })}

        {filteredTasks.length === 0 && (
          <div className={cn("col-span-full text-center py-20 rounded-[3rem]", currentTheme.vocab?.panelBg || "bg-white", currentTheme.vocab?.panelBorder ? `border ${currentTheme.vocab?.panelBorder}` : "shadow-sm")}>
            <Award className={cn("w-20 h-20 mx-auto mb-4", currentTheme.vocab?.darkMode ? "text-slate-700" : "text-slate-200")} />
            <p className={cn("text-lg font-bold", currentTheme.vocab?.darkMode ? "text-slate-500" : "text-slate-400")}>{currentTheme.vocab?.noTasks || "No chores right now. You're all caught up!"}</p>
          </div>
        )}
      </div>

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
          <h3 className={cn("text-2xl font-bold", currentTheme.vocab?.textPrimary || "text-slate-800")}>{currentTheme.vocab?.badges || 'My Badges'}</h3>
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
                  isEarned ? cn(badge.color, "bg-opacity-10 border-transparent shadow-sm") : "bg-slate-50 border-slate-100 opacity-60 grayscale"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-1 shadow-sm",
                  isEarned ? "bg-white" : "bg-slate-100"
                )}>
                  {badge.icon}
                </div>
                <div>
                  <p className={cn("font-bold text-sm leading-tight", isEarned ? "text-slate-800" : "text-slate-500")}>
                    {badge.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-tight px-1">{badge.description}</p>
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
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <div className={cn("border rounded-[3rem] p-8 shadow-xl max-w-sm w-full text-center relative overflow-hidden", currentTheme.vocab?.panelBg || "bg-white", currentTheme.vocab?.panelBorder || "border-slate-100")}>
              <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10", `bg-${currentTheme.primary}/10`)}>
                <CheckCircle2 className={cn("w-10 h-10", `text-${currentTheme.primary}`)} />
              </div>
              <h4 className={cn("text-3xl font-bold mb-2 relative z-10", currentTheme.vocab?.textPrimary || "text-slate-800")}>{currentTheme.vocab?.verifyTitle || 'All Done?'}</h4>
              <p className={cn("mb-8 relative z-10 text-sm font-medium", currentTheme.vocab?.textSecondary || "text-slate-500")}>
                {currentTheme.vocab?.verifyDesc || 'Did you complete'}<br/><span className={cn("text-lg font-bold", currentTheme.vocab?.textPrimary || "text-slate-800")}>"{confirmTask.taskTitle}"</span>?
              </p>
              
              <div className="flex gap-4 relative z-10">
                <button 
                  onClick={() => setConfirmTask(null)}
                  className={cn("flex-1 py-4 font-bold rounded-2xl transition-all", currentTheme.vocab?.darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeCompletion}
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
               <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-500 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] uppercase tracking-tighter italic">
                 +{xpAnimation.amount} XP
               </span>
            </div>
          </motion.div>
        )}

        {unlockedBadge && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-10 left-6 right-6 md:left-auto md:right-10 md:w-80 z-[100] bg-white border border-slate-200 rounded-[3rem] p-8 shadow-xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="text-6xl mb-6 animate-bounce">
                {unlockedBadge.icon}
              </div>
              <h4 className="text-2xl font-bold text-sky-500 mb-2">New Badge!</h4>
              <p className="text-slate-800 font-black text-lg leading-tight mb-2">{unlockedBadge.name}</p>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">{unlockedBadge.description}</p>
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
