import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { levelForXp } from '../../../lib/xp.js';

export const rewardService = {
  getRewards: (parentId: string) => {
    return db.prepare("SELECT * FROM rewards WHERE parentId = ?").all(parentId);
  },
  
  createReward: (parentId: string, title: string, description: string, xpCost: number, starCost?: number, allowanceCents?: number) => {
    const id = "reward_" + randomUUID();
    db.prepare("INSERT INTO rewards (id, parentId, title, description, xpCost, starCost, allowanceCents) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, parentId, title, description, xpCost, starCost ?? null, allowanceCents ?? null);
    return id;
  },
  
  getRewardById: (id: string) => {
    return db.prepare("SELECT * FROM rewards WHERE id = ?").get(id) as { parentId: string } | undefined;
  },

  deleteReward: (id: string) => {
    db.prepare("DELETE FROM rewards WHERE id = ?").run(id);
  },
  
  getClaimedRewards: (kidId: string) => {
    return db.prepare("SELECT * FROM claimedRewards WHERE kidId = ?").all(kidId);
  },
  
  claimReward: db.transaction((kidId: string, rewardId: string, _clientXpCost?: number) => {
    const id = "claim_" + randomUUID();
    const createdAt = Date.now();

    const reward = db.prepare("SELECT * FROM rewards WHERE id = ?").get(rewardId) as any;
    if (!reward) {
      throw new Error("Reward not found");
    }
    // Cost is authoritative from the reward row — never trust the client-supplied amount.
    const xpCost = Number(reward.xpCost) || 0;

    const user = db.prepare("SELECT xp, earnedStars, spentStars FROM users WHERE uid = ?").get(kidId) as any;
    if (!user || (user.xp || 0) < xpCost) {
      throw new Error("Not enough XP");
    }

    if (reward?.starCost && reward.starCost > 0) {
      const availableStars = (user.earnedStars || 0) - (user.spentStars || 0);
      if (availableStars < reward.starCost) {
        throw new Error("Not enough stars");
      }
      db.prepare("UPDATE users SET spentStars = spentStars + ? WHERE uid = ?").run(reward.starCost, kidId);
    }

    db.prepare("INSERT INTO claimedRewards (id, kidId, rewardId, createdAt) VALUES (?, ?, ?, ?)").run(id, kidId, rewardId, createdAt);

    const newXP = Math.max(0, (user.xp || 0) - xpCost);
    const newLevel = levelForXp(newXP);
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, kidId);
    const nextSpentStars = (user.spentStars || 0) + (reward?.starCost || 0);

    if (reward?.allowanceCents && reward.allowanceCents > 0) {
      const entryId = randomUUID();
      db.prepare(`
        INSERT INTO allowance_ledger (id, kidId, parentId, rewardId, rewardTitle, amountCents, status, claimedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(entryId, kidId, reward.parentId, rewardId, reward.title, reward.allowanceCents, new Date().toISOString());
    }

    return {
      claimedReward: { id, kidId, rewardId, createdAt },
      balances: {
        xp: newXP,
        level: newLevel,
        spentStars: nextSpentStars,
      },
    };
  }),

  getPendingAllowances: (parentId: string) => {
    return db.prepare(`
      SELECT al.*, u.name as kidName
      FROM allowance_ledger al
      JOIN users u ON al.kidId = u.uid
      WHERE al.parentId = ? AND al.status = 'pending'
      ORDER BY al.claimedAt DESC
    `).all(parentId);
  },

  getAllowanceById: (id: string) => {
    return db.prepare("SELECT id, parentId, status FROM allowance_ledger WHERE id = ?").get(id) as { id: string; parentId: string; status: string } | undefined;
  },

  // Scoped to the family so one parent can't settle another family's ledger entry.
  markAllowancePaid: (id: string, parentId: string) => {
    const result = db.prepare("UPDATE allowance_ledger SET status = 'paid', paidAt = ? WHERE id = ? AND parentId = ?")
      .run(new Date().toISOString(), id, parentId);
    return result.changes > 0;
  }
};
