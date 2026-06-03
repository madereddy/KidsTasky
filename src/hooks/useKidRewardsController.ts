import { useCallback, useEffect, useState } from 'react';
import { ClaimedReward, Reward, UserProfile } from '../types';
import { rewardService } from '../services/rewards';
import { sortEntities, upsertEntityByIdSorted } from '../lib/entity-list';

interface UseKidRewardsControllerOptions {
  profile: UserProfile;
  parentId: string;
  kidId: string;
  setLocalXp: React.Dispatch<React.SetStateAction<number>>;
  onProfileUpdate: () => void;
}

const claimedRewardTime = (reward: ClaimedReward) =>
  typeof reward.createdAt === 'number'
    ? reward.createdAt
    : Number(reward.createdAt?.seconds || 0);

export function useKidRewardsController({
  profile,
  parentId,
  kidId,
  setLocalXp,
  onProfileUpdate,
}: UseKidRewardsControllerOptions) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);
  const [localSpentStars, setLocalSpentStars] = useState(profile.spentStars || 0);

  const compareClaims = (left: ClaimedReward, right: ClaimedReward) => claimedRewardTime(right) - claimedRewardTime(left);

  useEffect(() => {
    setLocalSpentStars(profile.spentStars || 0);
  }, [profile.spentStars]);

  const loadRewards = useCallback(async () => {
    const [rewardRows, claimedRows] = await Promise.all([
      rewardService.getRewards(parentId),
      rewardService.getClaimedRewards(kidId),
    ]);
    setRewards(rewardRows || []);
    setClaimedRewards(sortEntities(claimedRows || [], compareClaims));
  }, [kidId, parentId]);

  useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  const claimReward = async (rewardId: string, xpCost: number) => {
    const result = await rewardService.claimReward(kidId, rewardId, xpCost);
    setClaimedRewards((prev) => upsertEntityByIdSorted(prev, result.claimedReward, compareClaims));
    setLocalXp(result.balances.xp);
    setLocalSpentStars(result.balances.spentStars);
    onProfileUpdate();
  };

  return {
    rewards,
    claimedRewards,
    availableStars: Math.max(0, (profile.earnedStars || 0) - localSpentStars),
    loadRewards,
    claimReward,
  };
}
