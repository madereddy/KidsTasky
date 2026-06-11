import { AnimatePresence, motion } from 'motion/react';
import { MissionCompletedPayload } from '../../types';

interface Props {
  payload: MissionCompletedPayload | null;
  kidName: string;
}

export function XpCelebration({ payload, kidName }: Props) {
  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          key="celebration"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 pointer-events-none"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center"
          >
            <div className="text-8xl mb-4">⭐</div>
            <div className="text-5xl font-black text-white mb-2">{kidName}</div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-7xl font-black text-yellow-400"
            >
              +{payload.xp} XP
            </motion.div>
            {payload.streakDay >= 3 && (
              <div className="mt-4 text-3xl text-orange-400 font-bold">
                🔥 {payload.streakDay} day streak!
              </div>
            )}
            {payload.badgesEarned.length > 0 && (
              <div className="mt-3 text-2xl text-white/80">
                New badge{payload.badgesEarned.length > 1 ? 's' : ''}: {payload.badgesEarned.map(b => b.replace('_', ' ')).join(', ')}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
