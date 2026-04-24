import React, { useState, useEffect } from 'react';
import { History, LogOut, Activity, Calendar, Clock, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { Task, UserProfile, Category, TaskCompletion } from '../types';
import { taskService } from '../services/taskService';
import { cn } from '../lib/utils';
import { THEMES, XP_REWARDS } from '../constants';

export function MissionHistoryModal({ 
  profile, 
  tasks,
  categories,
  onClose 
}: { 
  profile: UserProfile, 
  tasks: Task[],
  categories: Category[],
  onClose: () => void 
}) {
  const [history, setHistory] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const currentTheme = THEMES.find(t => t.id === profile.themeId) || THEMES[0];

  useEffect(() => {
    const fetchHistory = async () => {
      const h = await taskService.getHistoryForKid(profile.uid);
      setHistory(h || []);
      setLoading(false);
    };
    fetchHistory();
  }, [profile.uid]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-2xl rounded-[40px] p-6 md:p-10 shadow-2xl border-blue-500/20 max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Mission Archive</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Chronological Activity Log</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <LogOut className="w-6 h-6 rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Activity className={cn("w-8 h-8 animate-pulse", `text-${currentTheme.primary}`)} />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Syncing with Archive...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800 border-dashed">
              <p className="text-slate-500 text-sm italic">No entries found in the mission archive.</p>
            </div>
          ) : (
            history.map((entry: TaskCompletion, idx: number) => {
              const task = tasks.find((t: Task) => t.id === entry.taskId);
              const category = task ? categories.find(c => c.id === task.categoryId) : null;
              const completedAt = entry.completedAt;
              let date: Date;
              
              if (completedAt?.toDate) {
                date = completedAt.toDate();
              } else if (completedAt?.seconds) {
                date = new Date(completedAt.seconds * 1000);
              } else {
                date = new Date(completedAt || Date.now());
              }
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 transition-all group",
                    `hover:border-${currentTheme.primary}/30`
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
                    category ? category.color : "bg-slate-800 text-slate-500"
                  )}>
                    {category ? category.icon : '🛰️'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={cn("font-bold text-base truncate transition-colors", `group-hover:text-${currentTheme.primary}`)}>
                        {task?.title || 'Unknown Mission'}
                      </h4>
                      <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-lg border", `bg-${currentTheme.primary}/10 border-${currentTheme.primary}/20 shadow-[0_0_10px_rgba(var(--${currentTheme.primary}-rgb),0.1)]`)}>
                        <Zap className={cn("w-3 h-3", `text-${currentTheme.primary}`)} />
                        <span className={cn("text-[10px] font-black", `text-${currentTheme.primary}`)}>+{XP_REWARDS[task?.difficulty || 'easy']} XP</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {format(date, 'MMM d, yyyy')}
                      </p>
                      <span className="w-1 h-1 bg-slate-700 rounded-full" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(date, 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[9px] text-slate-600 text-center uppercase tracking-[0.2em] font-black">
            End of Mission Log — Secure Channel 778
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
