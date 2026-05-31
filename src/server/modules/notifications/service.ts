import { db } from '../../db.js';

export const notificationService = {
  getNotifications: (parentId: string) => {
    return db.prepare("SELECT * FROM notifications WHERE parentId = ? AND status = 'unread' ORDER BY createdAt DESC").all(parentId);
  },

  getNotificationById: (id: string) => {
    return db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as { parentId: string } | undefined;
  },

  markRead: (id: string) => {
    db.prepare("UPDATE notifications SET status = 'read' WHERE id = ?").run(id);
  },

  subscribePush: (id: string, userId: string, parentId: string, endpoint: string, p256dh: string, auth: string) => {
    db.prepare(`
      INSERT INTO push_subscriptions (id, userId, parentId, endpoint, p256dh, auth, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, parentId = excluded.parentId, p256dh = excluded.p256dh, auth = excluded.auth
    `).run(id, userId, parentId, endpoint, p256dh, auth, Date.now());
  },

  unsubscribePush: (endpoint: string, userId: string) => {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND userId = ?').run(endpoint, userId);
  },
};
