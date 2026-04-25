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
          "md:col-span-2 glass-panel p-6 rounded-3xl border-l-4 flex justify-between items-center relative overflow-hidden",
          `border-l-${currentTheme.accent}`
        )}>
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-1">Cadet Mission Log</h3>
            <p className="text-sm text-slate-500 uppercase tracking-widest font-black">Level {profile.level || 1} Elite</p>
          </div>
          <div className="flex gap-4 items-center relative z-10">
            <button 
              onClick={() => setShowThemeSelector(true)}
              className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-black">Combustion</p>
              <p className="text-2xl font-black italic text-orange-500 leading-none">{streak} DAYS</p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all",
              streak > 0 ? "bg-orange-500/20 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] animate-pulse" : "bg-slate-800 text-slate-600"
            )}>
              <Flame className={cn("w-7 h-7", streak > 0 && "fill-orange-500")} />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
        </div>

        <div className={cn(
          "glass-panel p-6 rounded-3xl border-l-4 flex flex-col justify-center relative overflow-hidden group",
          `border-l-${currentTheme.primary}`
        )}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Rank Progress</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white leading-none">{(profile.xp || 0) % 100}</span>
                <span className="text-xs font-bold text-slate-500 uppercase">/ 100 XP</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Total Career</p>
              <p className={cn("text-sm font-bold leading-none", `text-${currentTheme.primary}`)}>{profile.xp || 0} XP</p>
            </div>
          </div>
          
          <div className="w-full h-4 bg-slate-900 rounded-full border border-slate-800 p-0.5 overflow-hidden mb-3 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(profile.xp || 0) % 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn("h-full rounded-full relative", `bg-${currentTheme.primary}`)}
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
            </motion.div>
          </div>
          
          <div className="flex justify-between items-center">
            <p className={cn("text-[10px] font-bold uppercase tracking-tight flex items-center gap-1", `text-${currentTheme.primary}/80`)}>
              <TrendingUp className="w-3 h-3" /> {100 - ((profile.xp || 0) % 100)} XP to LEVEL { (profile.level || 1) + 1}
            </p>
            <span className="text-[10px] font-black text-slate-600 uppercase">{(profile.xp || 0) % 100}%</span>
          </div>
          
          {/* Subtle background flair */}
          <div className={cn("absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full translate-x-8 -translate-y-8 group-hover:opacity-20 transition-opacity", `bg-${currentTheme.primary}/10`)} />
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-yellow-500">
        <h3 className="text-xl font-black italic tracking-tighter uppercase mb-6 text-yellow-500">Mission Reward Store</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rewards.map((r: Reward) => {
            const isClaimed = claimedRewards.some((cr: ClaimedReward) => cr.rewardId === r.id);
            const canAfford = (profile.xp || 0) >= r.xpCost;
            return (
              <div key={r.id} className="bg-slate-950 p-4 rounded-xl flex justify-between items-center border border-slate-800">
                 <div>
                   <p className="font-bold text-slate-200">{r.title}</p>
                   <p className="text-slate-500 text-xs">{r.description} - <span className="text-yellow-500 font-bold">{r.xpCost} XP</span></p>
                 </div>
                 <button 
                   disabled={isClaimed || !canAfford}
                   onClick={() => claimReward(r.id, r.xpCost)}
                   className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", 
                     isClaimed ? "bg-slate-800 text-slate-500" : (canAfford ? "bg-yellow-600 text-white" : "bg-slate-800 text-slate-500"),
                     !isClaimed && canAfford && "hover:bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                   )}
                 >
                   {isClaimed ? "Claimed" : (canAfford ? "Claim" : "Not Enough XP")}
                 </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded-2xl">
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl">
            <button 
              onClick={() => setSortBy('time')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'time' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Clock className="w-3 h-3" /> Time
            </button>
            <button 
              onClick={() => setSortBy('created')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'created' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <CalendarDays className="w-3 h-3" /> New
            </button>
          </div>
        </div>

        <button 
          onClick={() => setShowHistory(true)}
          className={cn(
            "p-2 px-4 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",
            `bg-${currentTheme.primary}/20 text-${currentTheme.primary} border border-${currentTheme.primary}/30 hover:bg-${currentTheme.primary}/30 active:scale-95`
          )}
        >
          <History className="w-3 h-3" /> History
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
            />
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="col-span-full text-center py-12 glass-panel rounded-[40px]">
            <Award className="w-16 h-16 text-blue-500/20 mx-auto mb-4" />
            <p className="text-slate-500 italic uppercase text-xs tracking-widest font-bold">No missions in current star-system.</p>
          </div>
        )}
      </div>

      {progressPercent === 100 && totalSlots > 0 && (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 p-8 rounded-[40px] text-center glow-green"
        >
          <Award className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Maximum Efficiency</h3>
          <p className="text-emerald-400 font-bold uppercase text-[10px] tracking-widest">All Objectives Neutralized</p>
        </motion.div>
      )}

      {/* Alert Banner / Notification */}
      {tasks.some((t: Task) => getUrgency(t) === 'overdue') && (
        <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl glow-orange">
          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-slate-950">
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-amber-500 font-black text-xs uppercase tracking-widest">Ground Control Alert</p>
            <p className="text-slate-400 text-[10px] italic">Mission objectives are critical. Immediate deployment required.</p>
          </div>
        </div>
      )}

      {/* Badge Collection Section */}
      <div className="space-y-4 pt-8">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-xl font-bold italic uppercase tracking-tight">Badge Collection</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.values(BADGE_DEFS).map(badge => {
            const isEarned = (profile.badges || []).some(b => b.id === badge.id);
            return (
              <motion.div 
                key={badge.id}
                whileHover={isEarned ? { scale: 1.05 } : {}}
                className={cn(
                  "p-5 rounded-[30px] border-2 flex flex-col items-center justify-center text-center gap-3 transition-all relative overflow-hidden",
                  isEarned ? cn(badge.color, "bg-opacity-10 border-white/20 glow-blue shadow-lg") : "bg-slate-900 border-slate-800 opacity-40 grayscale"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-1 shadow-inner",
                  isEarned ? "bg-white/10" : "bg-slate-800"
                )}>
                  {badge.icon}
                </div>
                <div>
                  <p className={cn("font-black uppercase text-[10px] tracking-widest leading-tight", isEarned ? "text-white" : "text-slate-500")}>
                    {badge.name}
                  </p>
                  <p className="text-[8px] text-slate-500 italic mt-1 leading-tight px-1">{badge.description}</p>
                </div>
                {isEarned && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-3 right-3"
                  >
                    <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
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
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="bg-slate-900 border-2 border-slate-700 rounded-[40px] p-8 shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-500/5 glow-blue" />
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                <CheckCircle2 className="w-10 h-10 text-blue-500" />
              </div>
              <h4 className="text-2xl font-black uppercase italic tracking-tighter mb-2 relative z-10">Verify Mission</h4>
              <p className="text-slate-400 mb-8 relative z-10 uppercase text-[10px] font-bold tracking-widest leading-relaxed">
                Did you complete<br/><span className="text-white text-base">"{confirmTask.taskTitle}"</span>?
              </p>
              
              <div className="flex gap-4 relative z-10">
                <button 
                  onClick={() => setConfirmTask(null)}
                  className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeCompletion}
                  className="flex-1 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] glow-green"
                >
                  Confirm +{confirmTask.xpReward} XP
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
            className="fixed bottom-10 left-6 right-6 md:left-auto md:right-10 md:w-80 z-[100] bg-slate-950 border-2 border-blue-500 rounded-[40px] p-8 shadow-2xl glow-blue backdrop-blur-xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="text-6xl mb-6 animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                {unlockedBadge.icon}
              </div>
              <h4 className="text-xl font-black uppercase italic text-blue-400 mb-2 tracking-tighter">New Badge Earned!</h4>
              <p className="text-white font-black text-lg leading-tight mb-2 uppercase tracking-wide">{unlockedBadge.name}</p>
              <p className="text-slate-500 text-xs mb-8 italic leading-relaxed">{unlockedBadge.description}</p>
              <button 
                onClick={() => setUnlockedBadge(null)}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95"
              >
                Dismiss Communication
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
