import { db } from '../../db.js';
import { hashSecret, verifyAndUpgrade, verifySecret } from '../../lib/hashing.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';

import { randomBytes } from 'crypto';

export const authService = {
  getMe: (uid: string) => {
    return db.prepare("SELECT uid, role, name, email, parentId, xp, level, badges, themeId FROM users WHERE uid = ?").get(uid) as any;
  },
  login: async (email: string, passwordString: string) => {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !user.passwordHash) return null;
    
    const { match, newHash } = await verifyAndUpgrade(passwordString, user.passwordHash);
    if (!match) return null;

    if (newHash) {
      db.prepare("UPDATE users SET passwordHash = ? WHERE uid = ?").run(newHash, user.uid);
    }
    
    const token = jwt.sign({ uid: user.uid, role: user.role, parentId: user.parentId }, getJwtSecret(), { expiresIn: '24h' });
    return { user, token };
  },
  register: async (email: string, passwordString: string, name: string) => {
    const existing = db.prepare("SELECT uid FROM users WHERE email = ?").get(email);
    if (existing) throw new Error("Email taken");

    const uid = 'user_' + randomBytes(8).toString('hex');
    const hash = await hashSecret(passwordString);
    
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uid, 'parent', name, email, uid, hash);
      
    const token = jwt.sign({ uid, role: 'parent', parentId: uid }, getJwtSecret(), { expiresIn: '24h' });
    const user = authService.getMe(uid);
    return { user, token };
  },
  loginKid: async (uid: string, pin: string) => {
    const user = db.prepare("SELECT * FROM users WHERE uid = ? AND role = 'kid'").get(uid) as any;
    if (!user || !user.passwordHash) return null;

    const { match, newHash } = await verifyAndUpgrade(pin, user.passwordHash);
    if (!match) return null;

    if (newHash) {
      db.prepare("UPDATE users SET passwordHash = ? WHERE uid = ?").run(newHash, user.uid);
    }

    const token = jwt.sign({ uid: user.uid, role: user.role, parentId: user.parentId }, getJwtSecret(), { expiresIn: '24h' });
    return { user, token };
  },
  setPin: async (uid: string, pin: string) => {
    const hash = await hashSecret(pin);
    db.prepare("UPDATE users SET passwordHash = ? WHERE uid = ?").run(hash, uid);
  },
  changePassword: async (uid: string, currentPassword: string, newPassword: string) => {
    const user = db.prepare("SELECT uid, passwordHash FROM users WHERE uid = ? AND role = 'parent'").get(uid) as any;
    if (!user || !user.passwordHash) return false;

    const { match } = await verifySecret(currentPassword, user.passwordHash);
    if (!match) return false;

    const hash = await hashSecret(newPassword);
    db.prepare("UPDATE users SET passwordHash = ? WHERE uid = ?").run(hash, uid);
    return true;
  },
  verifyParentPassword: async (uid: string, password: string) => {
    const user = db.prepare("SELECT uid, passwordHash FROM users WHERE uid = ? AND (role = 'parent' OR role = 'coparent')").get(uid) as any;
    if (!user || !user.passwordHash) return false;
    const { match, newHash } = await verifyAndUpgrade(password, user.passwordHash);
    if (match && newHash) {
      db.prepare("UPDATE users SET passwordHash = ? WHERE uid = ?").run(newHash, user.uid);
    }
    return match;
  },
  refresh: (uid: string, role: string, parentId: string) => {
    const token = jwt.sign({ uid, role, parentId }, getJwtSecret(), { expiresIn: '24h' });
    return { token };
  },
  getKidsByParentEmail: (email: string) => {
    const parent = db.prepare("SELECT uid FROM users WHERE email = ? AND role = 'parent'").get(email) as any;
    if (!parent) return [];
    return db.prepare("SELECT uid, name, xp, level, themeId FROM users WHERE parentId = ? AND role = 'kid'").all(parent.uid) as any[];
  }
};
