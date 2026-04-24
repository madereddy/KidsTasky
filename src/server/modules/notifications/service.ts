import { db } from '../../db.js';

export const notificationService = {
  getNotifications: (parentId: string) => {
    return db.prepare("SELECT * FROM notifications WHERE parentId = ? AND status = 'unread' ORDER BY createdAt DESC").all(parentId);
  },
  
  markRead: (id: string) => {
    db.prepare("UPDATE notifications SET status = 'read' WHERE id = ?").run(id);
  }
};
