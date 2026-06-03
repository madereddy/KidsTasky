// @vitest-environment jsdom
import { rewardService } from './rewards';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

describe('Reward System', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => 'mock_token', setItem: () => {}, removeItem: () => {} });
  });

  it('should fetch rewards for a parent', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'r1', title: 'Test Reward', xpCost: 100 }]
    });

    const rewards = await rewardService.getRewards('p1');
    expect(rewards[0].title).toBe('Test Reward');
  });

  it('should create a reward', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new_reward' })
    });

    const id = await rewardService.createReward({ parentId: 'p1', title: 'New', xpCost: 50 });
    expect(id).toBe('new_reward');
  });

  it('should return claimed reward payload and balances when claiming', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        claimedReward: { id: 'c1', kidId: 'k1', rewardId: 'r1', createdAt: { seconds: 1 } },
        balances: { xp: 100, level: 2, spentStars: 10 },
      })
    });

    const result = await rewardService.claimReward('k1', 'r1', 0);
    expect(result).toEqual({
      claimedReward: { id: 'c1', kidId: 'k1', rewardId: 'r1', createdAt: { seconds: 1 } },
      balances: { xp: 100, level: 2, spentStars: 10 },
    });
  });
});
