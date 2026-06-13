import React from 'react';
import { Trophy, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../../../types';
import { BADGE_DEFS } from '../../../constants';
import { cn } from '../../../lib/utils';

interface Props {
  profile: UserProfile;
  isDarkMode: boolean;
  toneSecondary: string;
  themeVocab?: any;
}

export function BadgeCollection({ profile, isDarkMode, toneSecondary, themeVocab }: Props) {
  return (
    <div className="space-y-4 pt-8">
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h3 className={cn("text-2xl font-bold", themeVocab?.textPrimary || "text-ui-primary")}>
          {themeVocab?.badges || 'My Badges'}
        </h3>
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
  );
}
