import React from 'react';
import { CheckCircle2, Lock, AlertCircle, Clock, Activity, Zap, ShieldAlert, Hourglass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Category, TaskCompletion } from '../../types';
import { cn } from '../../lib/utils';
import { XP_REWARDS } from '../../constants';
import { useDisplayMode } from '../../contexts/DisplayContext';

export function TaskCard({ task, isDone, isLocked, onToggle, urgency, slotLabel, category, themeVocab, darkMode = false, completion, onSkip }: { 
  task: Task, 
  isDone: boolean, 
  isLocked?: boolean,
  onToggle: () => void | Promise<void>, 
  urgency: 'none' | 'soon' | 'overdue',
  slotLabel?: string,
  category?: Category,
  themeVocab?: any,
  darkMode?: boolean,
  key?: React.Key,
  onSkip?: () => void | Promise<void>
  completion?: TaskCompletion
}) {
  const { isWallMode } = useDisplayMode();
  const accentColor = isDone ? 'border-emerald-500' : (isLocked ? (darkMode ? 'border-ui-dark' : 'border-ui') : (urgency === 'overdue' ? 'border-red-400' : (darkMode ? 'border-ui-dark' : 'border-ui')));
  
  const getStatusConfig = () => {
    if (isDone) {
      if (completion?.approvalStatus === 'pending') {
        return { label: 'Pending Approval', icon: <Hourglass className="w-4 h-4" />, color: darkMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-amber-700 bg-amber-50 border-amber-200' };
      }
      if (completion?.approvalStatus === 'rejected') {
        return { label: 'Rejected', icon: <ShieldAlert className="w-4 h-4" />, color: darkMode ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-rose-700 bg-rose-50 border-rose-200' };
      }
      if (completion?.approvalStatus === 'skipped') {
        return { label: 'Skipped', icon: <Hourglass className="w-4 h-4" />, color: darkMode ? 'text-slate-300 bg-slate-500/10 border-slate-500/30' : 'text-slate-700 bg-slate-50 border-slate-200' };
      }
      return { label: themeVocab?.completed || 'Done', icon: <CheckCircle2 className="w-4 h-4" />, color: darkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
    
    if (isLocked) {
      return { label: themeVocab?.locked || 'Locked', icon: <Lock className="w-3 h-3" />, color: darkMode ? 'text-ui-muted-2 bg-ui-dark border-ui-dark' : 'text-ui-muted-2 bg-ui-soft-2 border-ui' };
    }
    
    if (urgency === 'overdue') {
      return { label: themeVocab?.overdue || 'Overdue', icon: <AlertCircle className="w-3 h-3" />, color: darkMode ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-red-700 bg-red-50 border-red-200' };
    }
    
    if (urgency === 'soon') {
      return { label: 'Starting Soon', icon: <Clock className="w-3 h-3" />, color: darkMode ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : 'text-sky-700 bg-sky-50 border-sky-200' };
    }
    
    return { label: 'To Do', icon: <Activity className="w-3 h-3" />, color: darkMode ? 'text-ui-muted-2 bg-ui-dark border-ui-dark' : 'text-ui-secondary bg-ui-soft border-ui' };
  };

  const statusConfig = getStatusConfig();

  return (
    <motion.div 
      layout
      whileTap={!isLocked ? { scale: 0.98 } : {}}
      whileHover={!isLocked ? { y: -2 } : {}}
      onClick={!isLocked ? onToggle : undefined}
      className={cn(
        "group relative overflow-hidden rounded-[2rem] p-6 transition-all border-2",
        darkMode ? "bg-ui-dark-50 backdrop-blur-sm" : "bg-white",
        !isLocked ? "cursor-pointer" : "cursor-not-allowed opacity-80",
        accentColor,
        isDone ? (darkMode ? "opacity-60 bg-emerald-500/5 border-emerald-500/30" : "opacity-70 bg-emerald-50 shadow-sm") : (isLocked ? (darkMode ? "bg-ui-deep grayscale" : "bg-ui-soft grayscale") : (darkMode ? "hover:shadow-lg shadow-black/20 hover:border-ui-dark-2" : "shadow-sm hover:shadow-md hover:border-ui-soft-strong")),
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
                darkMode ? "bg-ui-dark border-ui-dark text-ui-muted-2" : "bg-ui-soft-2 border-ui text-ui-secondary"
              )}
            >
              {slotLabel || (
                task.frequency === 'custom' 
                  ? `Every ${task.customInterval} Days` 
                  : task.frequency === 'weekdays'
                    ? 'Weekdays'
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
            {task.assignedKidId === 'all' && (
              <span className={cn(
                "text-[10px] font-bold px-2.5 py-1.5 rounded-xl uppercase tracking-wider border",
                darkMode ? "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" : "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
              )}>
                Up for Grabs
              </span>
            )}
          </div>
          <motion.h3 
            layout
            className={cn("text-2xl font-bold mt-2", isDone ? "line-through text-ui-muted" : (darkMode ? "text-white" : "text-ui-primary"))}
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
              : (isLocked ? (darkMode ? "bg-ui-dark border-ui-dark text-ui-secondary" : "bg-ui-soft-2 border-ui text-ui-muted-2") : (urgency === 'overdue' 
                  ? (darkMode ? `bg-rose-500/20 text-rose-500 border-rose-500/50${isWallMode ? '' : ' animate-pulse'}` : "bg-red-50 text-red-500 border-red-200") 
                  : (urgency === 'soon' ? (darkMode ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-sky-50 text-sky-500 border-sky-100") : (darkMode ? "bg-ui-dark text-ui-muted-2 border-ui-dark hover:border-ui-dark-2 hover:text-ui-secondary shadow-lg" : "bg-white text-ui-secondary border-ui shadow-sm hover:border-sky-300"))))
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
        <div className="mt-4 flex gap-2">
          <motion.button 
            whileHover={!isLocked ? { scale: 1.02 } : {}}
            whileTap={!isLocked ? { scale: 0.98 } : {}}
            disabled={isLocked}
            className={cn(
              "flex-1 py-4 font-bold rounded-2xl transition-all uppercase tracking-wider text-sm relative overflow-hidden flex items-center justify-center gap-2",
              isLocked 
                ? (darkMode ? "bg-ui-dark text-ui-secondary border border-ui-dark cursor-not-allowed" : "bg-ui-soft text-ui-muted-2 cursor-not-allowed border border-ui")
                : urgency === 'overdue' ? (darkMode ? "bg-amber-500 text-ui-primary shadow-[0_0_20px_rgba(245,158,11,0.4)]" : "bg-red-50 text-red-500 hover:bg-red-100") : (darkMode ? "bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/40" : "bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700")
            )}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isLocked ? <><Lock className="w-4 h-4" /> {themeVocab?.locked || 'Locked'}</> : (themeVocab?.markDone || "Mark Done")}
            </span>
          </motion.button>
          {onSkip && !isLocked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSkip(); }}
              className={cn(
                "px-4 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs border",
                darkMode ? "bg-ui-dark border-ui-dark text-ui-secondary hover:text-white" : "bg-white border-ui text-ui-muted hover:text-ui-primary"
              )}
            >
              Skip
            </button>
          )}
        </div>
      ) : completion?.approvalStatus === 'rejected' ? (
        <div className="mt-4 flex gap-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex-1 py-4 font-bold rounded-2xl text-center uppercase tracking-wider text-sm flex items-center justify-center gap-2", darkMode ? "bg-rose-500/10 text-rose-300 border border-rose-500/30" : "bg-rose-50 text-rose-700 border border-rose-200")}
          >
            <ShieldAlert className="w-4 h-4" /> Not Approved
          </motion.div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void onToggle(); }}
            className={cn(
              "px-4 py-4 rounded-2xl font-black uppercase tracking-wider text-xs border-2",
              darkMode ? "bg-blue-600/20 border-blue-500/40 text-blue-300 hover:text-white" : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
            )}
          >
            Try Again
          </button>
        </div>
      ) : completion?.approvalStatus === 'pending' ? (
        <div className="mt-4 flex gap-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex-1 py-4 font-bold rounded-2xl text-center uppercase tracking-wider text-sm flex items-center justify-center gap-2", darkMode ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200")}
          >
            <Hourglass className="w-4 h-4" /> Waiting for Approval
          </motion.div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void onToggle(); }}
            className={cn(
              "px-4 py-4 rounded-2xl font-black uppercase tracking-wider text-xs border-2",
              darkMode ? "bg-ui-dark border-ui-dark text-ui-secondary hover:text-white" : "bg-ui-soft-2 border-ui text-ui-secondary hover:bg-ui-soft-3"
            )}
          >
            Cancel
          </button>
        </div>
      ) : completion?.approvalStatus === 'skipped' ? (
        <div className="mt-4 flex gap-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex-1 py-4 font-bold rounded-2xl text-center uppercase tracking-wider text-sm flex items-center justify-center gap-2", darkMode ? "bg-slate-500/10 text-slate-300 border border-slate-500/30" : "bg-slate-50 text-slate-700 border border-slate-200")}
          >
            <Hourglass className="w-4 h-4" /> Skipped
          </motion.div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void onToggle(); }}
            className={cn(
              "px-4 py-4 rounded-2xl font-black uppercase tracking-wider text-xs border-2",
              darkMode ? "bg-blue-600/20 border-blue-500/40 text-blue-300 hover:text-white" : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
            )}
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex-1 py-4 font-bold rounded-2xl text-center uppercase tracking-wider text-sm flex items-center justify-center gap-2", darkMode ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border border-emerald-200")}
          >
            <CheckCircle2 className="w-4 h-4" /> {themeVocab?.completed || 'Completed!'} +{XP_REWARDS[task.difficulty || 'easy']} {themeVocab?.points || 'XP'}
          </motion.div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void onToggle(); }}
            className={cn(
              "px-4 py-4 rounded-2xl font-black uppercase tracking-wider text-xs border-2",
              darkMode ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:text-white" : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
            )}
          >
            Undo Completion
          </button>
        </div>
      )}
    </motion.div>
  );
}


