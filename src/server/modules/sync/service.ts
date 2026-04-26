// src/server/modules/sync/service.ts
import { db } from '../../db.js';

export const syncService = {
  getConnections: (parentId: string) => {
    return db.prepare("SELECT id, provider, createdAt FROM sync_connections WHERE parentId = ?").all(parentId);
  },

  deleteConnection: (id: string, parentId?: string) => {
    db.prepare("DELETE FROM events WHERE source = 'google' AND parentId = (SELECT parentId FROM sync_connections WHERE id = ?)").run(id);
    db.prepare("DELETE FROM sync_connections WHERE id = ?").run(id);
  },

  saveGoogleTokens: (parentId: string, accessToken: string, refreshToken?: string | null) => {
    const connId = 'sync_' + Date.now();
    db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET accessToken=excluded.accessToken, refreshToken=excluded.refreshToken
    `).run(connId, parentId, 'google', accessToken, refreshToken);
  },

  saveManualConnection: (parentId: string, email: string, appPassword: string) => {
    const connId = 'sync_manual_' + Date.now();
    db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, email, appPassword) 
      VALUES (?, ?, 'google_manual', ?, ?)
    `).run(connId, parentId, email, appPassword);
  }
};
