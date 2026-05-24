import { db } from '../../db.js';

export const userService = {
  getUser: (uid: string) => {
    return db.prepare("SELECT * FROM users WHERE uid = ?").get(uid) as any;
  },
  
  createUser: async (data: any) => {
    let passwordHash = data.passwordHash || null;
    if (data.pin && !passwordHash) {
       const bcrypt = await import('bcrypt');
       passwordHash = await bcrypt.default.hash(data.pin, 10);
    }

    db.prepare(`
      INSERT OR REPLACE INTO users (uid, role, name, email, parentId, xp, level, badges, themeId, passwordHash, isManaged)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.uid, 
      data.role, 
      data.name, 
      data.email || null, 
      data.parentId || null, 
      data.xp || 0, 
      data.level || 1, 
      JSON.stringify(data.badges || []), 
      data.themeId || null,
      passwordHash,
      data.isManaged ? 1 : 0
    );
  },
  
  addBadge: (uid: string, badgeId: string) => {
    const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid) as any;
    if (user) {
      const badges = JSON.parse(user.badges || "[]");
      if (!badges.some((b: any) => b.id === badgeId)) {
        badges.push({ id: badgeId, earnedAt: Date.now() });
        db.prepare("UPDATE users SET badges = ? WHERE uid = ?").run(JSON.stringify(badges), uid);
      }
    }
  },
  
  addXP: (uid: string, xpChange: number) => {
    const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid) as any;
    if (user) {
      const newXP = Math.max(0, (user.xp || 0) + xpChange);
      const newLevel = Math.floor(newXP / 100) + 1;
      db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, uid);
    }
  },
  
  updateTheme: (uid: string, themeId: string) => {
    db.prepare("UPDATE users SET themeId = ? WHERE uid = ?").run(themeId, uid);
  },
  
  getKidsByParent: (parentId: string) => {
    return db.prepare("SELECT * FROM users WHERE parentId = ? AND role = 'kid'").all(parentId) as any[];
  },

  setMemberColor: (uid: string, color: string) => {
    db.prepare('UPDATE users SET color = ? WHERE uid = ?').run(color, uid);
  },
};
