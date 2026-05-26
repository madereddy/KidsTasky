import { db } from '../../db.js';

export const inviteService = {
  createInvite: (parentId: string, parentName: string, type: 'kid' | 'coparent' = 'kid') => {
    // Expire existing active invites of the same type for this parent
    db.prepare("UPDATE invites SET status = 'expired' WHERE parentId = ? AND type = ? AND status = 'active'")
      .run(parentId, type);
    
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.prepare("INSERT INTO invites (id, parentId, parentName, createdAt, status, type) VALUES (?, ?, ?, ?, 'active', ?)")
      .run(id, parentId, parentName, Date.now(), type);
    return id;
  },
  
  getActiveInvite: (parentId: string) => {
    return db.prepare("SELECT * FROM invites WHERE parentId = ? AND status = 'active' AND type = 'kid'").get(parentId);
  },
  
  validateInvite: (code: string) => {
    return db.prepare("SELECT * FROM invites WHERE id = ? AND status = 'active'").get(code);
  },

  markInviteUsed: (code: string) => {
    db.prepare("UPDATE invites SET status = 'used' WHERE id = ?").run(code);
  }
};
