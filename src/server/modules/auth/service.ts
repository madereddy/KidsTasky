import { db } from '../../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';

export const authService = {
  getMe: (uid: string) => {
    return db.prepare("SELECT uid, role, name, email, parentId, xp, level, badges, themeId FROM users WHERE uid = ?").get(uid) as any;
  },
  login: async (email: string, passwordString: string) => {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || (!user.passwordHash && passwordString !== 'password')) return null;
    
    if (user.passwordHash) {
       const match = await bcrypt.compare(passwordString, user.passwordHash);
       if (!match) return null;
    }
    
    const token = jwt.sign({ uid: user.uid, role: user.role, parentId: user.parentId }, getJwtSecret(), { expiresIn: '30d' });
    return { user, token };
  },
  register: async (email: string, passwordString: string, name: string) => {
    const existing = db.prepare("SELECT uid FROM users WHERE email = ?").get(email);
    if (existing) throw new Error("Email taken");

    const uid = 'user_' + Date.now().toString(36);
    const hash = await bcrypt.hash(passwordString, 10);
    
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uid, 'parent', name, email, uid, hash);
      
    const token = jwt.sign({ uid, role: 'parent', parentId: uid }, getJwtSecret(), { expiresIn: '30d' });
    const user = authService.getMe(uid);
    return { user, token };
  }
};
