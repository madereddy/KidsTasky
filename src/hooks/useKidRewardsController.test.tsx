// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKidRewardsController } from './useKidRewardsController';

vi.mock('../services/rewards', () => ({
  rewardService: {
    getRewards: vi.fn(),
    getClaimedRewards: vi.fn(),
    claimReward: vi.fn(),
  },
}));

import { rewardService } from '../services/rewards';

describe('useKidRewardsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rewardService.getRewards).mockResolvedValue([
      { id: 'r1', parentId: 'p1', title: 'Reward', xpCost: 100 },
    ] as any);
    vi.mocked(rewardService.getClaimedRewards).mockResolvedValue([] as any);
  });

  it('loads rewards and claimed rewards', async () => {
    const setLocalXp = vi.fn();
    const { result } = renderHook(() => useKidRewardsController({
      profile: { uid: 'k1', role: 'kid', name: 'Kid', email: 'kid@test.com', earnedStars: 50, spentStars: 10 },
      parentId: 'p1',
      kidId: 'k1',
      setLocalXp,
      onProfileUpdate: vi.fn(),
    }));

    await waitFor(() => expect(result.current.rewards).toHaveLength(1));
    expect(result.current.availableStars).toBe(40);
  });

  it('updates claimed rewards and balances from authoritative claim response', async () => {
    const setLocalXp = vi.fn();
    const onProfileUpdate = vi.fn();
    vi.mocked(rewardService.claimReward).mockResolvedValue({
      claimedReward: { id: 'c1', kidId: 'k1', rewardId: 'r1', createdAt: { seconds: 2 } },
      balances: { xp: 100, level: 2, spentStars: 15 },
    } as any);

    const { result } = renderHook(() => useKidRewardsController({
      profile: { uid: 'k1', role: 'kid', name: 'Kid', email: 'kid@test.com', earnedStars: 50, spentStars: 10 },
      parentId: 'p1',
      kidId: 'k1',
      setLocalXp,
      onProfileUpdate,
    }));

    await waitFor(() => expect(result.current.rewards).toHaveLength(1));

    await act(async () => {
      await result.current.claimReward('r1', 0);
    });

    expect(result.current.claimedRewards).toHaveLength(1);
    expect(result.current.claimedRewards[0].id).toBe('c1');
    expect(result.current.availableStars).toBe(35);
    expect(setLocalXp).toHaveBeenCalledWith(100);
    expect(onProfileUpdate).toHaveBeenCalled();
  });
});
