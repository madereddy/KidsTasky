import { LeaderboardEntry } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  entries: LeaderboardEntry[];
  isWallMode?: boolean;
}

const ROLE_EMOJI: Record<string, string> = { kid: '🧒', parent: '👤', coparent: '👤' };

export function FamilyLeaderboard({ entries, isWallMode }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => (
        <div
          key={entry.userId}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-gray-800',
            idx === 0 && 'ring-2 ring-yellow-400/60',
            isWallMode && 'p-4'
          )}
        >
          <div className={cn('text-2xl w-8 text-center font-black', isWallMode && 'text-3xl')}>
            {idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn('font-semibold truncate', isWallMode ? 'text-lg' : 'text-sm')}>
              {ROLE_EMOJI[entry.role]} {entry.name}
            </div>
          </div>
          <div className="text-right">
            <div className={cn('font-black text-yellow-500', isWallMode ? 'text-2xl' : 'text-base')}>
              {entry.weeklyXp} XP
            </div>
            {entry.deltaFromLastWeek !== 0 && (
              <div className={cn(
                'text-xs font-medium',
                entry.deltaFromLastWeek > 0 ? 'text-emerald-500' : 'text-red-400'
              )}>
                {entry.deltaFromLastWeek > 0 ? '+' : ''}{entry.deltaFromLastWeek}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
