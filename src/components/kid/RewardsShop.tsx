import React from 'react';
import { Gift, Star, Zap } from 'lucide-react';
import { Reward, ClaimedReward } from '../../types';
import { cn } from '../../lib/utils';

interface RewardsShopProps {
  rewards: Reward[];
  claimedRewards: ClaimedReward[];
  kidXP: number;
  kidStars: number;
  onClaim: (rewardId: string, xpCost: number) => void;
}

export function RewardsShop({ rewards, claimedRewards, kidXP, kidStars, onClaim }: RewardsShopProps) {
  const claimedSet = new Set(claimedRewards.map(cr => cr.rewardId));

  function canAfford(reward: Reward): boolean {
    if (kidXP < reward.xpCost) return false;
    if (reward.starCost && reward.starCost > 0 && kidStars < reward.starCost) return false;
    return true;
  }

  return (
    <div className="space-y-6">
      {/* Balance bar */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-2xl px-4 py-2">
          <Zap className="w-4 h-4 text-sky-500" />
          <span className="font-bold text-sky-700">{kidXP} XP</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-amber-700">{kidStars} ⭐ stars</span>
        </div>
      </div>

      {/* Reward cards */}
      {rewards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-ui-muted gap-3">
          <Gift className="w-12 h-12 opacity-30" />
          <p className="text-sm">No rewards available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rewards.map(reward => {
            const isClaimed = claimedSet.has(reward.id);
            const affordable = canAfford(reward);
            const disabled = isClaimed || !affordable;

            return (
              <div key={reward.id} className={cn(
                "rounded-2xl border p-5 flex justify-between items-start gap-4 transition-colors",
                isClaimed ? "bg-ui-soft border-ui opacity-60" : (affordable ? "bg-white border-ui shadow-sm" : "bg-ui-soft border-ui")
              )}>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-ui-primary truncate">{reward.title}</p>
                  {reward.description && (
                    <p className="text-sm text-ui-muted mt-0.5 line-clamp-2">{reward.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-sm font-semibold text-sky-600 bg-sky-50 rounded-lg px-2 py-0.5">
                      {reward.xpCost} XP
                    </span>
                    {reward.starCost && reward.starCost > 0 && (
                      <span className="text-sm font-semibold text-amber-600 bg-amber-50 rounded-lg px-2 py-0.5">
                        {reward.starCost} ⭐
                      </span>
                    )}
                    {reward.allowanceCents && reward.allowanceCents > 0 && (
                      <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-2 py-0.5">
                        ${(reward.allowanceCents / 100).toFixed(2)} allowance
                      </span>
                    )}
                  </div>
                </div>
                <button
                  disabled={disabled}
                  onClick={() => !disabled && onClaim(reward.id, reward.xpCost)}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                    isClaimed
                      ? "bg-ui-soft-2 text-ui-muted cursor-not-allowed"
                      : affordable
                      ? "bg-sky-500 text-white hover:bg-sky-400"
                      : "bg-ui-soft-2 text-ui-muted cursor-not-allowed"
                  )}
                >
                  {isClaimed ? "Claimed" : affordable ? "Claim" : "Not enough"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Redemption history */}
      {claimedRewards.length > 0 && (
        <div className="border-t border-ui pt-4">
          <h3 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">Recent Claims</h3>
          <div className="space-y-2">
            {claimedRewards.slice(0, 5).map(cr => {
              const reward = rewards.find(r => r.id === cr.rewardId);
              return (
                <div key={cr.id} className="flex items-center justify-between text-sm">
                  <span className="text-ui-secondary">{reward?.title ?? 'Reward'}</span>
                  <span className="text-ui-muted text-xs">{reward ? `${reward.xpCost} XP` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
