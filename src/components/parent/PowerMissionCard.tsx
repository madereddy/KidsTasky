import { Zap } from 'lucide-react';
import { PowerMission } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  mission: PowerMission | null;
  isWallMode?: boolean;
}

export function PowerMissionCard({ mission, isWallMode }: Props) {
  if (!mission) return null;

  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-400/30',
      isWallMode && 'p-5'
    )}>
      <div className="p-3 rounded-xl bg-yellow-400/20 text-yellow-500">
        <Zap size={isWallMode ? 32 : 24} fill="currentColor" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-black text-yellow-500 uppercase tracking-wider', isWallMode && 'text-sm')}>
            ⚡ Power Mission — 2× XP
          </span>
        </div>
        <h3 className={cn('font-bold truncate text-gray-900 dark:text-white', isWallMode ? 'text-xl' : 'text-base')}>
          {mission.title}
        </h3>
        <div className={cn('text-gray-500 dark:text-gray-400', isWallMode ? 'text-base' : 'text-sm')}>
          {mission.assignedKidName} · {mission.xpReward * 2} XP on completion
        </div>
      </div>
    </div>
  );
}
