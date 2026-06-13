import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface Props {
  confirmTask: any;
  setConfirmTask: (t: any) => void;
  proofAnswers: Record<string, string>;
  setProofAnswers: (a: any) => void;
  executeCompletion: () => void;
  xpAnimation: { active: boolean; amount: number };
  showStarBurst: boolean;
  starsAwarded: number;
  celebrationTick: number;
  unlockedBadge: any;
  dismissUnlockedBadge: () => void;
  currentTheme: any;
  toneSecondary: string;
}

export function CelebrationOverlays({
  confirmTask,
  setConfirmTask,
  proofAnswers,
  setProofAnswers,
  executeCompletion,
  xpAnimation,
  showStarBurst,
  starsAwarded,
  celebrationTick,
  unlockedBadge,
  dismissUnlockedBadge,
  currentTheme,
  toneSecondary
}: Props) {
  return (
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
                {confirmTask.questions!.map((q: string, i: number) => (
                  <div key={`proof-${i}`}>
                    <label className="block text-xs text-ui-muted mb-1">{q}</label>
                    <input
                      className="w-full border border-ui rounded-xl px-3 py-2 text-sm text-ui-primary"
                      value={proofAnswers[`q_${i}`] || ''}
                      onChange={(e) => setProofAnswers((prev: any) => ({ ...prev, [`q_${i}`]: e.target.value }))}
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
                disabled={(confirmTask.questions || []).length > 0 && (confirmTask.questions || []).some((_: any, i: number) => !String(proofAnswers[`q_${i}`] || '').trim())}
                className={cn("flex-1 py-4 font-bold rounded-2xl transition-all shadow-md", `bg-${currentTheme.primary} text-white hover:bg-${currentTheme.accent}`)}
              >
                {currentTheme.vocab?.confirmYes || 'Yes!'} +{confirmTask.xpReward} {currentTheme.vocab?.points || 'Points'}
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
  );
}
