import { db } from '../../db.js';

export const inviteService = {
  createInvite: (parentId: string, parentName: string) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.prepare("INSERT INTO invites (id, parentId, parentName, createdAt, status) VALUES (?, ?, ?, ?, ?)").run(id, parentId, parentName, Date.now(), 'active');
    return id;
  },
  
  getActiveInvite: (parentId: string) => {
    return db.prepare("SELECT * FROM invites WHERE parentId = ? AND status = 'active'").get(parentId);
  },
  
  validateInvite: (code: string) => {
    return db.prepare("SELECT * FROM invites WHERE id = ? AND status = 'active'").get(code);
  }
};
