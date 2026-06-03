import { ClaimedReward, Reward } from '../types';
import { fetchAPI } from './http';

export const rewardService = {
  async getRewards(parentId: string): Promise<Reward[]> {
    return await fetchAPI('/parents/' + parentId + '/rewards');
  },

  async createReward(reward: any): Promise<string> {
    const res = await fetchAPI('/rewards', {
      method: "POST",
      body: JSON.stringify(reward)
    });
    return res.id;
  },

  async deleteReward(rewardId: string): Promise<void> {
    await fetchAPI('/rewards/' + rewardId, { method: "DELETE" });
  },

  async getClaimedRewards(kidId: string): Promise<ClaimedReward[]> {
    return await fetchAPI('/kids/' + kidId + '/claimedRewards');
  },

  async claimReward(kidId: string, rewardId: string, xpCost: number): Promise<{
    claimedReward: ClaimedReward;
    balances: { xp: number; level: number; spentStars: number };
  }> {
    return await fetchAPI('/claimedRewards', {
      method: "POST",
      body: JSON.stringify({ kidId, rewardId, xpCost })
    });
  }
};
