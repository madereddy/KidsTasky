import React from 'react';
import { CheckCircle2, Lock, AlertCircle, Clock, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Category } from '../types';
import { cn } from '../lib/utils';
import { XP_REWARDS } from '../constants';

export function TaskCard({ task, isDone, isLocked, onToggle, urgency, slotLabel, category }: { 
  task: Task, 
  isDone: boolean, 
  isLocked?: boolean,
  onToggle: () => void | Promise<void>, 
  urgency: 'none' | 'soon' | 'overdue',
  slotLabel?: string,
  category?: Category,
  key?: React.Key
}) {
  const accentColor = isDone ? 'border-l-emerald-500' : (isLocked ? 'border-l-slate-700' : (urgency === 'overdue' ? 'border-l-amber-500' : 'border-l-blue-500'));
  
  const statusConfig = isDone 
    ? { label: 'MISSION COMPLETED', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
    : (isLocked 
        ? { label: 'SYSTEM LOCKED', icon: <Lock className="w-3 h-3" />, color: 'text-slate-400 bg-slate-800/80 border-slate-700' }
        : (urgency === 'overdue' 
            ? { label: 'SYSTEM ALERT: OVERDUE', icon: <AlertCircle className="w-3 h-3" />, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse' }
            : urgency === 'soon'
            ? { label: 'IMMINENT: UPCOMING', icon: <Clock className="w-3 h-3" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
            : { label: 'STATUS: PENDING', icon: <Activity className="w-3 h-3" />, color: 'text-slate-400 bg-slate-800/80 border-slate-700' }));

  return (
    <motion.div 
      layout
      whileTap={!isLocked ? { scale: 0.98 } : {}}
      whileHover={!isLocked ? { y: -2 } : {}}
      onClick={!isLocked ? onToggle : undefined}
      className={cn(
        "card-immersive group relative overflow-hidden",
        !isLocked ? "cursor-pointer" : "cursor-not-allowed opacity-80",
        accentColor,
        isDone ? "opacity-60 bg-emerald-500/5 shadow-none" : (isLocked ? "bg-slate-900/50 grayscale-[0.5]" : (urgency === 'overdue' ? "bg-amber-500/5 glow-orange border-amber-500/30" : "hover:shadow-lg hover:shadow-blue-500/10")),
      )}
    >
      {/* Top Status Accent Bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        isDone ? "bg-emerald-500" : (isLocked ? "bg-slate-700" : (urgency === 'overdue' ? "bg-amber-500 animate-pulse" : (urgency === 'soon' ? "bg-blue-500" : "bg-slate-700")))
      )} />

      {/* Background Effect for Overdue */}
      {urgency === 'overdue' && !isDone && !isLocked && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      )}

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-2">
            <motion.div 
              layout
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all",
                statusConfig.color
              )}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </motion.div>
            
            <motion.span 
              layout
              className={cn(
                "text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-500"
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
                "text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest border transition-all flex items-center gap-1.5",
                task.difficulty === 'easy' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                task.difficulty === 'medium' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                "bg-rose-500/10 text-rose-400 border-rose-500/20"
              )}>
                <Zap className="w-3 h-3" />
                {task.difficulty} | +{XP_REWARDS[task.difficulty]} XP
              </span>
            )}
            {category && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider text-white", category.color)}>
                {category.icon} {category.name}
              </span>
            )}
          </div>
          <motion.h3 
            layout
            className={cn("text-xl font-bold mt-2", isDone && "line-through text-slate-500")}
          >
            {task.title}
          </motion.h3>
          <p className={cn("text-[10px] mt-1 italic font-bold tracking-tight", isDone ? "text-emerald-500/70" : (isLocked ? "text-slate-500" : (urgency === 'overdue' ? "text-rose-500 animate-pulse" : "text-slate-500")))}>
            {isDone ? "✓ MISSION NEUTRALIZED" : (isLocked ? "🔒 PREREQUISITES REQUIRED" : (urgency === 'overdue' ? "⚠ ALARM: MISSION OVERDUE" : "○ AWAITING DEPLOYMENT..."))}
          </p>
        </div>
        
        <motion.div 
          initial={false}
          animate={{ 
            scale: isDone ? [1, 1.2, 1] : 1,
            rotate: isDone ? [0, 15, -15, 0] : 0,
            boxShadow: isDone 
              ? "0 0 20px rgba(16, 185, 129, 0.4)" 
              : (urgency === 'overdue' && !isLocked ? "0 0 20px rgba(244, 63, 94, 0.4)" : "none")
          }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className={cn(
            "w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl shrink-0 ml-4 border-2 transition-colors",
            isDone 
              ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50" 
              : (isLocked ? "bg-slate-900 border-slate-800 text-slate-600" : (urgency === 'overdue' 
                  ? "bg-rose-500/20 text-rose-500 border-rose-500/50 animate-pulse" 
                  : (urgency === 'soon' ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "text-slate-400 border-slate-800")))
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
              {isDone ? '🚀' : (isLocked ? <Lock className="w-6 h-6 text-slate-600" /> : (category ? category.icon : (slotLabel === 'Morning' ? '🌅' : (slotLabel === 'Evening' ? '🌙' : '🛰️'))))}
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
            "w-full py-3 font-black rounded-xl transition-all uppercase tracking-widest text-[10px] relative overflow-hidden flex items-center justify-center gap-2",
            isLocked 
              ? "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
              : urgency === 'overdue' ? "bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]" : "bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/40"
          )}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isLocked ? <><Lock className="w-3 h-3" /> Locked: Wait for Clearance</> : "Execute Mission"}
          </span>
          {urgency === 'overdue' && !isLocked && (
            <motion.div 
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute inset-0 bg-white/20 -skew-x-12"
            />
          )}
        </motion.button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full py-3 bg-emerald-500/10 text-emerald-500 font-black rounded-xl text-center uppercase tracking-widest text-[10px] border border-emerald-500/20 flex items-center justify-center gap-2"
        >
          <Zap className="w-3 h-3 animate-pulse" /> Mission Verified: +{XP_REWARDS[task.difficulty || 'easy']} XP
        </motion.div>
      )}
    </motion.div>
  );
}
