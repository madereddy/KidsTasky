import { db } from '../../db.js';
import bcrypt from 'bcrypt';
import { levelForXp } from '../../../lib/xp.js';

export const userService = {
  getUser: (uid: string) => {
    return db.prepare("SELECT * FROM users WHERE uid = ?").get(uid) as any;
  },
  
  createUser: async (data: any) => {
    // Never overwrite an existing account — INSERT OR REPLACE here was an
    // account-takeover vector (wipes passwordHash / reassigns parentId).
    const exists = db.prepare("SELECT uid FROM users WHERE uid = ?").get(data.uid);
    if (exists) throw new Error('User already exists');

    let passwordHash = data.passwordHash || null;
    if (data.pin && !passwordHash) {
       passwordHash = await bcrypt.hash(data.pin, 10);
    }

    db.prepare(`
      INSERT INTO users (uid, role, name, email, parentId, xp, level, badges, themeId, passwordHash, isManaged)
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
      const newLevel = levelForXp(newXP);
      db.prepare("UPDATE users SET xp = ?, level = ? WHERE uid = ?").run(newXP, newLevel, uid);
    }
  },
  
  updateTheme: (uid: string, themeId: string) => {
    db.prepare("UPDATE users SET themeId = ? WHERE uid = ?").run(themeId, uid);
  },
  
  getKidsByParent: (parentId: string) => {
    return db.prepare("SELECT * FROM users WHERE parentId = ? AND role = 'kid'").all(parentId) as any[];
  },

  getUserParentId: (uid: string): string | null => {
    const row = db.prepare("SELECT parentId FROM users WHERE uid = ?").get(uid) as { parentId: string } | undefined;
    return row?.parentId ?? null;
  },

  setMemberColor: (uid: string, color: string) => {
    db.prepare('UPDATE users SET color = ? WHERE uid = ?').run(color, uid);
  },

  setAvatar: (uid: string, avatarPreset: string | null, avatarUrl: string | null) => {
    db.prepare('UPDATE users SET avatarPreset = ?, avatarUrl = ? WHERE uid = ?')
      .run(avatarPreset, avatarUrl, uid);
  },

  createCoParent: async (data: { uid: string; name: string; email: string; password: string; parentId: string }) => {
    const passwordHash = await bcrypt.hash(data.password, 10);
    db.prepare(`
      INSERT INTO users (uid, role, name, email, parentId, passwordHash)
      VALUES (?, 'parent', ?, ?, ?, ?)
    `).run(data.uid, data.name, data.email, data.parentId, passwordHash);
  },

  removeCoParent: (uid: string, ownerUid: string) => {
    const user = db.prepare("SELECT uid FROM users WHERE uid = ? AND parentId = ? AND role = 'parent' AND uid != ?")
      .get(uid, ownerUid, ownerUid) as any;
    if (!user) throw new Error('Co-parent not found');
    
    // UPDATE only — never DELETE. Row must survive to serve 401 for in-flight tokens.
    db.prepare("UPDATE users SET revokedAt = ?, parentId = NULL WHERE uid = ?")
      .run(Date.now(), uid);
    
    // Clean up push subscriptions
    try {
      db.prepare("DELETE FROM push_subscriptions WHERE userId = ?").run(uid);
    } catch { /* table created in Group D */ }
  },

  getCoParents: (ownerUid: string) => {
    return db.prepare("SELECT uid, name, email FROM users WHERE parentId = ? AND role = 'parent' AND uid != ?")
      .all(ownerUid, ownerUid);
  },
};
