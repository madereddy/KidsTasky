// src/server/modules/sync/service.ts
import { db } from '../../db.js';
import { google } from 'googleapis';
import { CalendarEvent, SyncConnection } from '../../../types.js';

export type SyncCalendarError = {
  calendarId: string;
  message: string;
};

export type SyncNowResult = {
  successCount: number;
  failureCount: number;
  errors: SyncCalendarError[];
  startedAt: number;
  finishedAt: number;
  imported: number;
  updated: number;
};

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

export const GOOGLE_EVENT_COLOR_MAP: Record<string, string> = {
  '1': '#a4bdfc',
  '2': '#7ae7bf',
  '3': '#dbadff',
  '4': '#ff887c',
  '5': '#fbd75b',
  '6': '#ffb878',
  '7': '#46d6db',
  '8': '#e1e1e1',
  '9': '#5484ed',
  '10': '#51b749',
  '11': '#dc2127',
};

export function resolveEventColor(
  colorId: string | null | undefined,
  colorMap: Record<string, string>,
  calendarColor: string | undefined,
): string {
  return (colorId && colorMap[colorId]) || calendarColor || '#6366f1';
}

export function buildSyncCalendarId(connectionId: string, calendarId: string): string {
  const encodedCalendar = Buffer.from(calendarId).toString('base64url');
  return `syncal_${connectionId}_${encodedCalendar}`;
}

async function withTokenRefresh<T>(
  connection: SyncConnection,
  fn: (conn: SyncConnection) => Promise<T>
): Promise<T> {
  try {
    return await fn(connection);
  } catch (e: any) {
    const status = e?.response?.status ?? e?.code;
    const isTransient = status === 401 || (typeof status === 'number' && status >= 500 && status < 600);
    if (isTransient && connection.refreshToken) {
      const oauth2 = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      oauth2.setCredentials({ refresh_token: connection.refreshToken });
      const { credentials } = await oauth2.refreshAccessToken();
      const newAccessToken = credentials.access_token!;
      db.prepare('UPDATE sync_connections SET accessToken = ? WHERE id = ?').run(newAccessToken, connection.id);
      const refreshed: SyncConnection = { ...connection, accessToken: newAccessToken };
      return await fn(refreshed);
    }
    throw e;
  }
}

function persistSyncStatus(connectionId: string, status: 'ok' | 'partial' | 'error') {
  db.prepare('UPDATE sync_connections SET lastSyncAt = ?, lastSyncStatus = ? WHERE id = ?').run(
    Date.now(),
    status,
    connectionId,
  );
}

export const syncService = {
  getConnections: (parentId: string) => {
    return db.prepare('SELECT id, provider, createdAt, lastSyncAt, lastSyncStatus FROM sync_connections WHERE parentId = ?').all(parentId);
  },

  getConnectionById: (id: string) => {
    return db.prepare('SELECT * FROM sync_connections WHERE id = ?').get(id) as { parentId: string } | undefined;
  },

  deleteConnection: (id: string) => {
    db.prepare("DELETE FROM events WHERE source = 'google' AND parentId = (SELECT parentId FROM sync_connections WHERE id = ?)").run(id);
    db.prepare('DELETE FROM sync_connections WHERE id = ?').run(id);
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
    }).catch((e) => { console.error('[sync:push_failed]', e); return null; });
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
    }).catch((e) => { console.error('[sync:update_failed]', e); });
  },

  getSyncCalendars: (connectionId: string) => {
    return db.prepare('SELECT * FROM sync_calendars WHERE connectionId = ?').all(connectionId);
  },

  getSyncCalendarsByParent: (parentId: string) => {
    return db.prepare('SELECT sc.*, sconn.provider FROM sync_calendars sc JOIN sync_connections sconn ON sc.connectionId = sconn.id WHERE sc.parentId = ?').all(parentId);
  },

  getGoogleConnectionsByParent: (parentId: string): SyncConnection[] => {
    return db.prepare(
      "SELECT * FROM sync_connections WHERE parentId = ? AND provider = 'google'"
    ).all(parentId) as SyncConnection[];
  },

  getSyncCalendarById: (id: string) => {
    return db.prepare('SELECT * FROM sync_calendars WHERE id = ?').get(id) as { id: string; parentId: string; calendarId: string } | undefined;
  },

  upsertSyncCalendar: (connectionId: string, parentId: string, calendarId: string, name: string, color?: string, isSharedCalendar?: number) => {
    const id = buildSyncCalendarId(connectionId, calendarId);
    db.prepare(`
      INSERT INTO sync_calendars (id, connectionId, parentId, calendarId, name, enabled, color, isSharedCalendar)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(connectionId, calendarId) DO UPDATE SET id = excluded.id, name = excluded.name, color = COALESCE(excluded.color, color), isSharedCalendar = COALESCE(excluded.isSharedCalendar, isSharedCalendar)
    `).run(id, connectionId, parentId, calendarId, name, color ?? null, isSharedCalendar ?? null);
  },

  toggleSyncCalendar: (id: string, enabled: boolean) => {
    const row = syncService.getSyncCalendarById(id);
    if (!row) return;
    db.prepare('UPDATE sync_calendars SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    if (!enabled) {
      db.prepare("DELETE FROM events WHERE parentId = ? AND source = 'google' AND sourceCalendarId = ?").run(row.parentId, row.calendarId);
    }
  },

  getEnabledCalendarIds: (connectionId: string): string[] => {
    const rows = db.prepare('SELECT calendarId FROM sync_calendars WHERE connectionId = ? AND enabled = 1').all(connectionId) as { calendarId: string }[];
    return rows.map(r => r.calendarId);
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
    }).catch((e) => { console.error('[sync:delete_failed]', e); });
  },

  syncGoogleConnectionNow: async (connection: SyncConnection): Promise<SyncNowResult> => {
    const startedAt = Date.now();
    const errors: SyncCalendarError[] = [];
    let imported = 0;
    let updated = 0;
    let successCount = 0;
    let failureCount = 0;

    try {
      await withTokenRefresh(connection, async (conn) => {
        const calendar = getCalendarClient(conn);

        const colorMapResponse = await calendar.colors.get();
        const apiEventColors = colorMapResponse.data.event || {};
        const googleEventColors: Record<string, string> = { ...GOOGLE_EVENT_COLOR_MAP };
        for (const [colorId, value] of Object.entries(apiEventColors)) {
          if (value?.background) googleEventColors[colorId] = value.background;
        }

        const calList = await calendar.calendarList.list();
        const allCals = (calList.data.items || []).filter(c => c.id && c.accessRole !== 'freeBusyReader');
        const calendarColorById = new Map<string, string>();
        for (const cal of allCals) {
          if (cal.id) {
            calendarColorById.set(cal.id, cal.backgroundColor || cal.foregroundColor || '#6366f1');
          }
          const id = buildSyncCalendarId(conn.id, cal.id!);
          const calColor = cal.backgroundColor || cal.foregroundColor || '#6366f1';
          const isShared = cal.accessRole !== 'owner' ? 1 : 0;
          db.prepare(`
            INSERT INTO sync_calendars (id, connectionId, parentId, calendarId, name, enabled, color, isSharedCalendar)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(connectionId, calendarId) DO UPDATE SET id = excluded.id, name = excluded.name, color = excluded.color, isSharedCalendar = excluded.isSharedCalendar
          `).run(id, conn.id, conn.parentId, cal.id!, cal.summary || cal.id!, calColor, isShared);
        }

        const calendarRows = db.prepare('SELECT calendarId, enabled FROM sync_calendars WHERE connectionId = ?').all(conn.id) as { calendarId: string; enabled: number }[];
        const enabledRows = calendarRows.filter(r => r.enabled === 1);
        const enabledIds = enabledRows.map(r => r.calendarId);
        const calendarIds = calendarRows.length === 0 ? allCals.map(c => c.id!) : enabledIds;
        if (calendarRows.length === 0 && calendarIds.length === 0) calendarIds.push('primary');

        for (const calId of calendarIds) {
          try {
            const res = await calendar.events.list({
              calendarId: calId,
              timeMin: new Date().toISOString(),
              maxResults: 50,
              singleEvents: true,
              orderBy: 'startTime',
            });
            for (const ev of (res.data.items || [])) {
              if (!ev.id || !ev.summary || !ev.start?.dateTime || !ev.end?.dateTime) continue;
              const eId = 'ext_' + ev.id;
              const derivedColor = resolveEventColor(ev.colorId, googleEventColors, calendarColorById.get(calId));
              const existing = db.prepare('SELECT id FROM events WHERE externalId = ?').get(eId) as { id: string } | undefined;
              if (!existing) {
                db.prepare('INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source, sourceCalendarId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                  eId, conn.parentId, ev.summary, ev.description || '',
                  new Date(ev.start.dateTime).getTime(), new Date(ev.end.dateTime).getTime(),
                  null, derivedColor, eId, 'google', calId
                );
                imported += 1;
              } else {
                db.prepare('UPDATE events SET title = ?, description = ?, startTime = ?, endTime = ?, color = ?, sourceCalendarId = ? WHERE id = ?').run(
                  ev.summary, ev.description || '',
                  new Date(ev.start.dateTime).getTime(), new Date(ev.end.dateTime).getTime(),
                  derivedColor, calId, existing.id
                );
                updated += 1;
              }
            }
            successCount += 1;
          } catch (calErr: any) {
            failureCount += 1;
            const msg = calErr instanceof Error ? calErr.message : String(calErr);
            errors.push({ calendarId: calId, message: msg });
            console.error('[sync:calendar_failed]', { connectionId: conn.id, calendarId: calId, error: msg });
          }
        }
      });
    } catch (e: any) {
      failureCount += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ calendarId: 'connection', message: msg });
      console.error('[sync:connection_failed]', { connectionId: connection.id, error: msg });
    }

    const finishedAt = Date.now();
    const status = failureCount === 0 ? 'ok' : successCount > 0 ? 'partial' : 'error';
    persistSyncStatus(connection.id, status);

    return { successCount, failureCount, errors, startedAt, finishedAt, imported, updated };
  },
};
