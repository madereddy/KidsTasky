import React from 'react';
import { Settings, Flame, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../../../types';
import { cn } from '../../../lib/utils';
import { AvatarDisplay } from '../../shared/AvatarPicker';
import { xpProgress } from '../../../lib/xp';

interface KidHeaderProps {
  profile: UserProfile;
  streak: number;
  localXp: number;
  availableStars: number;
  localAvatar: { preset?: string; url?: string };
  currentTheme: any;
  isDarkMode: boolean;
  toneSecondary: string;
  onSetEditingAvatar: (editing: boolean) => void;
  onSetShowThemeSelector: (show: boolean) => void;
}

export function KidHeader({
  profile,
  streak,
  localXp,
  availableStars,
  localAvatar,
  currentTheme,
  isDarkMode,
  toneSecondary,
  onSetEditingAvatar,
  onSetShowThemeSelector,
}: KidHeaderProps) {
  const xpStats = xpProgress(localXp);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className={cn(
        "md:col-span-2 shadow-sm p-6 rounded-[2rem] border flex justify-between items-center relative overflow-hidden",
        currentTheme.vocab?.panelBg || "bg-white",
        currentTheme.vocab?.panelBorder || "border-ui-soft"
      )}>
        <div className="relative z-10">
          <h3 className={cn("text-2xl font-bold mb-1", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
            {currentTheme.vocab?.chores || 'My Chores'}
          </h3>
          <p className={cn("text-sm font-medium", toneSecondary)}>
            {currentTheme.vocab?.level || 'Level'} {xpStats.level}
          </p>
        </div>
        <div className="flex gap-4 items-center relative z-10">
          <button onClick={() => onSetEditingAvatar(true)}>
            <AvatarDisplay
              avatarPreset={localAvatar.preset ?? profile.avatarPreset}
              avatarUrl={localAvatar.url ?? profile.avatarUrl}
              name={profile.name}
              size={48}
            />
          </button>
          <button 
            onClick={() => onSetShowThemeSelector(true)}
            aria-label="Open theme settings"
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-colors border",
              currentTheme.vocab?.darkMode 
                ? "bg-ui-dark-2 border-ui-dark-2 text-ui-muted-2 hover:text-white" 
                : "bg-ui-soft border-ui-soft text-ui-muted-2 hover:text-ui-primary hover:bg-ui-soft-2"
            )}
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
              <span className={cn("text-3xl font-black leading-none", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                {xpStats.xpIntoLevel}
              </span>
              <span className={cn("text-sm font-bold uppercase", isDarkMode ? "text-ui-muted-2" : "text-ui-muted-2")}>
                / {xpStats.xpForLevelSpan} {currentTheme.vocab?.points || 'XP'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-lg">⭐</span>
              <span className={cn("font-bold text-lg", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                {availableStars}
              </span>
              <span className={cn("text-xs", isDarkMode ? "text-ui-muted-2" : "text-ui-muted-2")}>stars</span>
            </div>
            <div className="text-right">
              <p className={cn("text-[10px] uppercase font-bold mb-1", isDarkMode ? "text-ui-muted-2" : "text-ui-muted-2")}>Total</p>
              <p className={cn("text-base font-bold leading-none", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
                {localXp} {currentTheme.vocab?.points || 'XP'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="w-full h-6 bg-ui-soft-2 rounded-full overflow-hidden mb-3 shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${xpStats.percent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full rounded-full relative", `bg-${currentTheme.primary}`)}
          >
          </motion.div>
        </div>
        
        <div className="flex justify-between items-center mt-2">
          <p className={cn("text-xs font-bold flex items-center gap-1", toneSecondary)}>
            <TrendingUp className="w-4 h-4" /> {xpStats.xpToNext} {currentTheme.vocab?.points || 'XP'} to Next {currentTheme.vocab?.level || 'Level'}
          </p>
        </div>
      </div>
    </div>
  );
}
