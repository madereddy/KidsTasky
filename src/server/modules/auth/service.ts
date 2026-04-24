import { db } from '../../db.js';

export const authService = {
  login: (name: string) => {
    return db.prepare("SELECT * FROM users WHERE name = ? COLLATE NOCASE").get(name) as any;
  },
  
  getMe: (uid: string) => {
    return db.prepare("SELECT * FROM users WHERE uid = ?").get(uid) as any;
  }
};
