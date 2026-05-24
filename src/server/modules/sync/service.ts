// src/server/modules/sync/service.ts
import { db } from '../../db.js';
import { google } from 'googleapis';
import { CalendarEvent, SyncConnection } from '../../../types.js';

function getCalendarClient(connection: SyncConnection) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
  });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

function toGoogleEvent(event: CalendarEvent) {
  return {
    summary: event.title,
    description: event.description,
    start: { dateTime: new Date(event.startTime).toISOString() },
    end: { dateTime: new Date(event.endTime).toISOString() },
  };
}

async function withTokenRefresh(connection: SyncConnection, fn: (conn: SyncConnection) => Promise<any>) {
  try {
    return await fn(connection);
  } catch (e: any) {
    if (e?.response?.status === 401 || e?.code === 401) {
      const refreshed = syncService.getActiveGoogleConnection(connection.parentId);
      if (refreshed) {
        try { return await fn(refreshed); } catch (e2) { console.error('Google retry failed:', e2); }
      }
    } else {
      console.error('Google API error:', e);
    }
  }
}

export const syncService = {
  getConnections: (parentId: string) => {
    return db.prepare("SELECT id, provider, createdAt FROM sync_connections WHERE parentId = ?").all(parentId);
  },

  deleteConnection: (id: string) => {
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
  },

  getActiveGoogleConnection: (parentId: string): SyncConnection | null => {
    return db.prepare(
      "SELECT * FROM sync_connections WHERE parentId = ? AND provider = 'google' LIMIT 1"
    ).get(parentId) as SyncConnection | null;
  },

  pushEventToGoogle: async (parentId: string, event: CalendarEvent): Promise<string | null> => {
    const connection = syncService.getActiveGoogleConnection(parentId);
    if (!connection) return null;
    return withTokenRefresh(connection, async (conn) => {
      const calendar = getCalendarClient(conn);
      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: toGoogleEvent(event),
      });
      return res.data.id ?? null;
    }) ?? null;
  },

  updateEventInGoogle: async (parentId: string, event: CalendarEvent): Promise<void> => {
    if (!event.externalId) return;
    const connection = syncService.getActiveGoogleConnection(parentId);
    if (!connection) return;
    await withTokenRefresh(connection, async (conn) => {
      const calendar = getCalendarClient(conn);
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: event.externalId!,
        requestBody: toGoogleEvent(event),
      });
    });
  },

  deleteEventFromGoogle: async (parentId: string, externalId: string): Promise<void> => {
    const connection = syncService.getActiveGoogleConnection(parentId);
    if (!connection) return;
    await withTokenRefresh(connection, async (conn) => {
      const calendar = getCalendarClient(conn);
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: externalId,
      });
    });
  },
};
