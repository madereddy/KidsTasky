import { describe, it, expect, vi } from 'vitest';
import { taskService } from './taskService';

// Mock fetch
global.fetch = vi.fn();

describe('Reward System', () => {
  it('should fetch rewards for a parent', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'r1', title: 'Test Reward', xpCost: 100 }]
    });

    const rewards = await taskService.getRewards('p1');
    expect(rewards[0].title).toBe('Test Reward');
  });

  it('should create a reward', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new_reward' })
    });

    const id = await taskService.createReward({ parentId: 'p1', title: 'New', xpCost: 50 });
    expect(id).toBe('new_reward');
  });
});
