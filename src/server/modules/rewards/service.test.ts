// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db.js';
import { rewardService } from './service.js';

describe('rewardService', () => {
  const parentId = 'rewards_test_parent';
  const kidId = 'rewards_test_kid';
  let rewardId: string;

  beforeEach(() => {
    db.prepare('DELETE FROM claimedRewards WHERE kidId = ?').run(kidId);
    db.prepare('DELETE FROM rewards WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid IN (?, ?)').run(parentId, kidId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, xp, level, earnedStars, spentStars) VALUES (?, 'parent', 'RTest Parent', 'rp@test.com', ?, 0, 1, 0, 0)").run(parentId, parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, xp, level, earnedStars, spentStars) VALUES (?, 'kid', 'RTest Kid', 'rk@test.com', ?, 200, 2, 50, 0)").run(kidId, parentId);
    rewardId = rewardService.createReward(parentId, 'Extra Screen Time', '30 minutes', 100);
  });

  it('claimReward deducts XP from kid', () => {
    rewardService.claimReward(kidId, rewardId, 100);
    const kid = db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.xp).toBe(100); // 200 - 100
  });

  it('claimReward creates ledger entry in claimedRewards', () => {
    rewardService.claimReward(kidId, rewardId, 100);
    const claimed = db.prepare('SELECT * FROM claimedRewards WHERE kidId = ? AND rewardId = ?').get(kidId, rewardId) as any;
    expect(claimed).toBeTruthy();
    expect(claimed.kidId).toBe(kidId);
  });

  it('claimReward throws when XP insufficient', () => {
    expect(() => rewardService.claimReward(kidId, rewardId, 300)).toThrow('Not enough XP');
    const kid = db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as any;
    expect(kid.xp).toBe(200); // unchanged
  });

  it('claimReward throws when stars insufficient for star-cost reward', () => {
    const starRewardId = rewardService.createReward(parentId, 'Star Reward', '', 0, 100);
    expect(() => rewardService.claimReward(kidId, starRewardId, 0)).toThrow('Not enough stars');
    db.prepare('DELETE FROM rewards WHERE id = ?').run(starRewardId);
  });
});
