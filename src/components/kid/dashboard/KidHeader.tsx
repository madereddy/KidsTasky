import React from 'react';
import { Settings, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../../../types';
import { cn } from '../../../lib/utils';
import { AvatarDisplay } from '../../shared/AvatarPicker';
import { xpProgress } from '../../../lib/xp';

interface KidHeaderProps {
  profile: UserProfile;
  streak: number;
  localXp: number;
  localAvatar: { preset?: string; url?: string };
  currentTheme: any;
  onSetEditingAvatar: (editing: boolean) => void;
  onSetShowThemeSelector: (show: boolean) => void;
}

export function KidHeader({
  profile,
  streak,
  localXp,
  localAvatar,
  currentTheme,
  onSetEditingAvatar,
  onSetShowThemeSelector,
}: KidHeaderProps) {
  const xpStats = xpProgress(localXp);

  return (
    <div className={cn(
      "shadow-sm px-4 py-3 rounded-[2rem] border flex items-center gap-4",
      currentTheme.vocab?.panelBg || "bg-white",
      currentTheme.vocab?.panelBorder || "border-ui-soft"
    )}>
      <button onClick={() => onSetEditingAvatar(true)} className="flex-shrink-0">
        <AvatarDisplay
          avatarPreset={localAvatar.preset ?? profile.avatarPreset}
          avatarUrl={localAvatar.url ?? profile.avatarUrl}
          name={profile.name}
          size={44}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className={cn("text-sm font-bold", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
            {currentTheme.vocab?.level || 'Level'} {xpStats.level}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={cn("text-lg font-black leading-none", `text-${currentTheme.primary}`)}>{streak}</span>
            <Flame className={cn("w-5 h-5", streak > 0 ? `fill-${currentTheme.primary} text-${currentTheme.primary}` : "text-ui-muted-2")} />
          </div>
        </div>
        <div className="w-full h-2.5 bg-ui-soft-2 rounded-full overflow-hidden shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpStats.percent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full rounded-full", `bg-${currentTheme.primary}`)}
          />
        </div>
      </div>

      <button
        onClick={() => onSetShowThemeSelector(true)}
        aria-label="Open theme settings"
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors border",
          currentTheme.vocab?.darkMode
            ? "bg-ui-dark-2 border-ui-dark-2 text-ui-muted-2 hover:text-white"
            : "bg-ui-soft border-ui-soft text-ui-muted-2 hover:text-ui-primary hover:bg-ui-soft-2"
        )}
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}
