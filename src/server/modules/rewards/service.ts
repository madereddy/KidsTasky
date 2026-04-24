import { db } from '../../db.js';

export const rewardService = {
  getRewards: (parentId: string) => {
    return db.prepare("SELECT * FROM rewards WHERE parentId = ?").all(parentId);
  },
  
  createReward: (parentId: string, title: string, description: string, xpCost: number) => {
    const id = "reward_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
    db.prepare("INSERT INTO rewards (id, parentId, title, description, xpCost) VALUES (?, ?, ?, ?, ?)").run(id, parentId, title, description, xpCost);
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
    
    // Check points
    const user = db.prepare("SELECT xp FROM users WHERE uid = ?").get(kidId) as any;
    if (!user || user.xp < xpCost) {
      throw new Error("Not enough XP");
    }
    
    db.prepare("INSERT INTO claimedRewards (id, kidId, rewardId, createdAt) VALUES (?, ?, ?, ?)").run(id, kidId, rewardId, Date.now());
    
    // Consume XP
    const newXP = Math.max(0, (user.xp || 0) - xpCost);
    const newLevel = Math.floor(newXP / 100) + 1;
    db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, kidId);
    
    return id;
  })
};
