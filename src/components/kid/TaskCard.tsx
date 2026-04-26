import React from 'react';
import { CheckCircle2, Lock, AlertCircle, Clock, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Category } from '../../types';
import { cn } from '../../lib/utils';
import { XP_REWARDS } from '../../constants';

export function TaskCard({ task, isDone, isLocked, onToggle, urgency, slotLabel, category, themeVocab, darkMode = false }: { 
  task: Task, 
  isDone: boolean, 
  isLocked?: boolean,
  onToggle: () => void | Promise<void>, 
  urgency: 'none' | 'soon' | 'overdue',
  slotLabel?: string,
  category?: Category,
  themeVocab?: any,
  darkMode?: boolean,
  key?: React.Key
}) {
  const accentColor = isDone ? 'border-emerald-500' : (isLocked ? (darkMode ? 'border-slate-800' : 'border-slate-200') : (urgency === 'overdue' ? 'border-red-400' : (darkMode ? 'border-slate-800' : 'border-slate-200')));
  
  const statusConfig = isDone 
    ? { label: themeVocab?.completed || 'Done', icon: <CheckCircle2 className="w-4 h-4" />, color: darkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    : (isLocked 
        ? { label: themeVocab?.locked || 'Locked', icon: <Lock className="w-3 h-3" />, color: darkMode ? 'text-slate-400 bg-slate-900 border-slate-800' : 'text-slate-400 bg-slate-100 border-slate-200' }
        : (urgency === 'overdue' 
            ? { label: themeVocab?.overdue || 'Overdue', icon: <AlertCircle className="w-3 h-3" />, color: darkMode ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-red-700 bg-red-50 border-red-200' }
            : urgency === 'soon'
            ? { label: 'Starting Soon', icon: <Clock className="w-3 h-3" />, color: darkMode ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : 'text-sky-700 bg-sky-50 border-sky-200' }
            : { label: 'To Do', icon: <Activity className="w-3 h-3" />, color: darkMode ? 'text-slate-400 bg-slate-900 border-slate-800' : 'text-slate-600 bg-slate-50 border-slate-200' }));

  return (
    <motion.div 
      layout
      whileTap={!isLocked ? { scale: 0.98 } : {}}
      whileHover={!isLocked ? { y: -2 } : {}}
      onClick={!isLocked ? onToggle : undefined}
      className={cn(
        "group relative overflow-hidden rounded-[2rem] p-6 transition-all border-2",
        darkMode ? "bg-slate-900/50 backdrop-blur-sm" : "bg-white",
        !isLocked ? "cursor-pointer" : "cursor-not-allowed opacity-80",
        accentColor,
        isDone ? (darkMode ? "opacity-60 bg-emerald-500/5 border-emerald-500/30" : "opacity-70 bg-emerald-50 shadow-sm") : (isLocked ? (darkMode ? "bg-slate-950 grayscale" : "bg-slate-50 grayscale") : (darkMode ? "hover:shadow-lg shadow-black/20 hover:border-slate-700" : "shadow-sm hover:shadow-md hover:border-slate-300")),
      )}
    >

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-3">
            <motion.div 
              layout
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                statusConfig.color
              )}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </motion.div>
            
            <motion.span 
              layout
              className={cn(
                "text-[10px] font-bold px-2.5 py-1.5 rounded-xl uppercase tracking-wider border",
                darkMode ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
              )}
            >
              {slotLabel || (
                task.frequency === 'custom' 
                  ? `Every ${task.customInterval} Days` 
                  : task.frequency.replace('-', ' ')
              )}
            </motion.span>
            {task.difficulty && !isDone && (
              <span className={cn(
                "text-[10px] font-bold px-2.5 py-1.5 rounded-xl uppercase tracking-widest border flex items-center gap-1",
                task.difficulty === 'easy' ? (darkMode ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
                task.difficulty === 'medium' ? (darkMode ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200") :
                (darkMode ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-red-50 text-red-600 border-red-200")
              )}>
                <Zap className="w-3 h-3" />
                +{XP_REWARDS[task.difficulty]} XP
              </span>
            )}
            {category && (
              <span className={cn("text-[10px] font-bold px-2.5 py-1.5 rounded-xl uppercase tracking-wider text-white", category.color)}>
                {category.icon} {category.name}
              </span>
            )}
          </div>
          <motion.h3 
            layout
            className={cn("text-2xl font-bold mt-2", isDone ? "line-through text-slate-500" : (darkMode ? "text-white" : "text-slate-800"))}
          >
            {task.title}
          </motion.h3>
        </div>
        
        <motion.div 
          initial={false}
          animate={{ 
            scale: isDone ? [1, 1.2, 1] : 1,
            rotate: isDone ? [0, 15, -15, 0] : 0,
            boxShadow: isDone 
              ? (darkMode ? "0 0 20px rgba(16, 185, 129, 0.4)" : "0 0 20px rgba(16, 185, 129, 0.2)") 
              : "none"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className={cn(
            "w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-4xl shrink-0 ml-4 border-2 transition-colors relative",
            isDone 
              ? (darkMode ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50" : "bg-emerald-100 text-emerald-500 border-emerald-200") 
              : (isLocked ? (darkMode ? "bg-slate-900 border-slate-800 text-slate-600" : "bg-slate-100 border-slate-200 text-slate-400") : (urgency === 'overdue' 
                  ? (darkMode ? "bg-rose-500/20 text-rose-500 border-rose-500/50 animate-pulse" : "bg-red-50 text-red-500 border-red-200") 
                  : (urgency === 'soon' ? (darkMode ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-sky-50 text-sky-500 border-sky-100") : (darkMode ? "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200 shadow-lg" : "bg-white text-slate-600 border-slate-200 shadow-sm hover:border-sky-300"))))
          )}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={isDone ? 'done' : (isLocked ? 'locked' : 'pending')}
              initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
              transition={{ duration: 0.2 }}
            >
              {isDone ? <CheckCircle2 className="w-10 h-10" /> : (isLocked ? <Lock className="w-8 h-8 opacity-50" /> : (category ? category.icon : (slotLabel === 'Morning' ? '🌅' : (slotLabel === 'Evening' ? '🌙' : '⭐'))))}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
      
      {!isDone ? (
        <motion.button 
          whileHover={!isLocked ? { scale: 1.02 } : {}}
          whileTap={!isLocked ? { scale: 0.98 } : {}}
          disabled={isLocked}
          className={cn(
            "w-full py-4 font-bold rounded-2xl transition-all uppercase tracking-wider text-sm relative overflow-hidden flex items-center justify-center gap-2 mt-4",
            isLocked 
              ? (darkMode ? "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed" : "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200")
              : urgency === 'overdue' ? (darkMode ? "bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]" : "bg-red-50 text-red-500 hover:bg-red-100") : (darkMode ? "bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/40" : "bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700")
          )}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isLocked ? <><Lock className="w-4 h-4" /> {themeVocab?.locked || 'Locked'}</> : (themeVocab?.markDone || "Mark Done")}
          </span>
        </motion.button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("w-full py-4 font-bold rounded-2xl text-center uppercase tracking-wider text-sm mt-4 flex items-center justify-center gap-2", darkMode ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border border-emerald-200")}
        >
          <CheckCircle2 className="w-4 h-4" /> {themeVocab?.completed || 'Completed!'} +{XP_REWARDS[task.difficulty || 'easy']} {themeVocab?.points || 'XP'}
        </motion.div>
      )}
    </motion.div>
  );
}
