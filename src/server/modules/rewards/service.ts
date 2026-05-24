import { randomUUID } from 'crypto';
import { db } from '../../db.js';

export const rewardService = {
  getRewards: (parentId: string) => {
    return db.prepare("SELECT * FROM rewards WHERE parentId = ?").all(parentId);
  },
  
  createReward: (parentId: string, title: string, description: string, xpCost: number, starCost?: number, allowanceCents?: number) => {
    const id = "reward_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
    db.prepare("INSERT INTO rewards (id, parentId, title, description, xpCost, starCost, allowanceCents) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, parentId, title, description, xpCost, starCost ?? null, allowanceCents ?? null);
    return id;
  },
  
  deleteReward: (id: string) => {
    db.prepare("DELETE FROM rewards WHERE id = ?").run(id);
  },
  
  getClaimedRewards: (kidId: string) => {
    return db.prepare("SELECT * FROM claimedRewards WHERE kidId = ?").all(kidId);
  },
  
  claimReward: db.transaction((kidId: string, rewardId: string, xpCost: number) => {
    const id = "claim_" + Date.now().toString(36) + Math.random().toString(36).substr(2);

    const user = db.prepare("SELECT xp, earnedStars, spentStars FROM users WHERE uid = ?").get(kidId) as any;
    if (!user || user.xp < xpCost) {
      throw new Error("Not enough XP");
    }

    const reward = db.prepare("SELECT * FROM rewards WHERE id = ?").get(rewardId) as any;

    if (reward?.starCost && reward.starCost > 0) {
      const availableStars = (user.earnedStars || 0) - (user.spentStars || 0);
      if (availableStars < reward.starCost) {
        throw new Error("Not enough stars");
      }
      db.prepare("UPDATE users SET spentStars = spentStars + ? WHERE uid = ?").run(reward.starCost, kidId);
    }

    db.prepare("INSERT INTO claimedRewards (id, kidId, rewardId, createdAt) VALUES (?, ?, ?, ?)").run(id, kidId, rewardId, Date.now());

    const newXP = Math.max(0, (user.xp || 0) - xpCost);
    const newLevel = Math.floor(newXP / 100) + 1;
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, kidId);

    if (reward?.allowanceCents && reward.allowanceCents > 0) {
      const entryId = randomUUID();
      db.prepare(`
        INSERT INTO allowance_ledger (id, kidId, parentId, rewardId, rewardTitle, amountCents, status, claimedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(entryId, kidId, reward.parentId, rewardId, reward.title, reward.allowanceCents, new Date().toISOString());
    }

    return id;
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

  markAllowancePaid: (id: string) => {
    db.prepare("UPDATE allowance_ledger SET status = 'paid', paidAt = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  }
};
