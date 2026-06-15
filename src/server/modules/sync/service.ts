// src/server/modules/sync/service.ts
import { db } from '../../db.js';
import { google } from 'googleapis';
import Database from 'better-sqlite3';
import { CalendarEvent, SyncConnection } from '../../../types.js';
import { encryptField, decryptField } from '../../lib/crypto.js';
import { getSecretKey } from '../../config.js';
import { logger } from '../../lib/logger.js';

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


export function decryptConnection(conn: SyncConnection): SyncConnection {
  const key = getSecretKey();
  return {
    ...conn,
    accessToken: conn.accessToken ? decryptField(conn.accessToken, key) : conn.accessToken,
    refreshToken: conn.refreshToken ? decryptField(conn.refreshToken, key) : conn.refreshToken,
    appPassword: conn.appPassword ? decryptField(conn.appPassword, key) : conn.appPassword,
  };
}

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

export function buildLocalGoogleEventId(externalId: string): string {
  return `ext_${externalId}`;
}

export function toGoogleProviderEventId(externalId: string): string {
  return externalId.startsWith('ext_') ? externalId.slice(4) : externalId;
}

type ExistingEventRow = {
  id: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  color: string | null;
  sourceCalendarId: string | null;
};

type ReconcileStmts = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: Database.Statement<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: Database.Statement<any[]>;
};

async function buildGoogleEventColorMap(
  calendar: ReturnType<typeof getCalendarClient>
): Promise<Record<string, string>> {
  const colorMapResponse = await calendar.colors.get();
  const apiEventColors = colorMapResponse.data.event ?? {};
  const merged: Record<string, string> = { ...GOOGLE_EVENT_COLOR_MAP };
  for (const [colorId, value] of Object.entries(apiEventColors)) {
    if (value?.background) merged[colorId] = value.background;
  }
  return merged;
}

async function fetchAndUpsertCalendars(
  calendar: ReturnType<typeof getCalendarClient>,
  conn: SyncConnection
): Promise<{ calendarIds: string[]; calendarColorById: Map<string, string> }> {
  const upsertStmt = db.prepare(`
    INSERT INTO sync_calendars (id, connectionId, parentId, calendarId, name, enabled, color, isSharedCalendar)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(connectionId, calendarId) DO UPDATE SET id = excluded.id, name = excluded.name, color = excluded.color, isSharedCalendar = excluded.isSharedCalendar
  `);
  const calList = await calendar.calendarList.list();
  const allCals = (calList.data.items ?? []).filter(c => c.id && c.accessRole !== 'freeBusyReader');
  const calendarColorById = new Map<string, string>();
  for (const cal of allCals) {
    if (cal.id) calendarColorById.set(cal.id, cal.backgroundColor ?? cal.foregroundColor ?? '#6366f1');
    const id = buildSyncCalendarId(conn.id, cal.id!);
    const color = cal.backgroundColor ?? cal.foregroundColor ?? '#6366f1';
    const isShared = cal.accessRole !== 'owner' ? 1 : 0;
    upsertStmt.run(id, conn.id, conn.parentId, cal.id!, cal.summary ?? cal.id!, color, isShared);
  }
  const calendarRows = db.prepare('SELECT calendarId, enabled FROM sync_calendars WHERE connectionId = ?')
    .all(conn.id) as { calendarId: string; enabled: number }[];
  const enabledRows = calendarRows.filter(r => r.enabled === 1);
  const enabledIds = enabledRows.map(r => r.calendarId);
  const calendarIds = calendarRows.length === 0 ? allCals.map(c => c.id!) : enabledIds;
  if (calendarRows.length === 0 && calendarIds.length === 0) calendarIds.push('primary');
  return { calendarIds, calendarColorById };
}

function loadExistingGoogleEvents(parentId: string): Map<string, ExistingEventRow> {
  const rows = db.prepare(
    "SELECT id, externalId, title, description, startTime, endTime, color, sourceCalendarId FROM events WHERE parentId = ? AND source = 'google' AND externalId IS NOT NULL"
  ).all(parentId) as Array<ExistingEventRow & { externalId: string }>;
  return new Map(rows.map(row => [row.externalId, {
    id: row.id, title: row.title, description: row.description,
    startTime: row.startTime, endTime: row.endTime, color: row.color, sourceCalendarId: row.sourceCalendarId
  }]));
}

function reconcileCalendarEvents(
  googleEvents: Array<{ id?: string | null; summary?: string | null; start?: { dateTime?: string | null } | null; end?: { dateTime?: string | null } | null; colorId?: string | null; description?: string | null }>,
  existingMap: Map<string, ExistingEventRow>,
  stmts: ReconcileStmts,
  googleEventColors: Record<string, string>,
  calendarColorById: Map<string, string>,
  calId: string,
  parentId: string
): { imported: number; updated: number } {
  let imported = 0;
  let updated = 0;
  for (const ev of googleEvents) {
    if (!ev.id || !ev.summary || !ev.start?.dateTime || !ev.end?.dateTime) continue;
    const externalId = ev.id;
    const eId = buildLocalGoogleEventId(externalId);
    const derivedColor = resolveEventColor(ev.colorId, googleEventColors, calendarColorById.get(calId));
    const startTime = new Date(ev.start.dateTime).getTime();
    const endTime = new Date(ev.end.dateTime).getTime();
    const description = ev.description ?? '';
    const existing = existingMap.get(externalId) ?? existingMap.get(eId);
    if (!existing) {
      stmts.insert.run(eId, parentId, ev.summary, description, startTime, endTime, null, derivedColor, externalId, 'google', calId);
      existingMap.set(externalId, { id: eId, title: ev.summary, description, startTime, endTime, color: derivedColor, sourceCalendarId: calId });
      imported += 1;
    } else {
      const hasChanges =
        existing.title !== ev.summary ||
        (existing.description ?? '') !== description ||
        existing.startTime !== startTime ||
        existing.endTime !== endTime ||
        (existing.color ?? '') !== (derivedColor ?? '') ||
        (existing.sourceCalendarId ?? '') !== calId ||
        existingMap.get(eId)?.id === existing.id;
      if (hasChanges) {
        stmts.update.run(ev.summary, description, startTime, endTime, derivedColor, calId, externalId, existing.id);
        existingMap.set(externalId, { id: existing.id, title: ev.summary, description, startTime, endTime, color: derivedColor, sourceCalendarId: calId });
        updated += 1;
      }
    }
  }
  return { imported, updated };
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
      logger.warn({
        connectionId: connection.id,
        status,
        hasRefreshToken: Boolean(connection.refreshToken),
        provider: connection.provider,
      }, 'sync_token_refresh_attempt');
      try {
        const refreshed = await syncService.refreshGoogleConnectionTokens(connection);
        logger.info({
          connectionId: connection.id,
          hasAccessToken: Boolean(refreshed?.accessToken),
          hasRefreshToken: Boolean(refreshed?.refreshToken),
        }, 'sync_token_refresh_ok');
        return await fn(refreshed);
      } catch (refreshError: any) {
        logger.error({
          connectionId: connection.id,
          provider: connection.provider,
          status: refreshError?.response?.status ?? refreshError?.code ?? null,
          message: String(refreshError?.message || refreshError),
        }, 'sync_token_refresh_failed');
        throw refreshError;
      }
    }
    throw e;
  }
}

function persistSyncStatus(connectionId: string, status: 'ok' | 'partial' | 'error') {
  db.prepare('UPDATE sync_connections SET lastSyncAt = ?, lastSyncStatus = ? WHERE id = ?')
    .run(Date.now(), status, connectionId);
}

export const syncService = {
  getConnections: (parentId: string) => {
    return db.prepare(`
      SELECT id, provider, createdAt, lastSyncAt, lastSyncStatus
      FROM sync_connections
      WHERE parentId = ?
      ORDER BY COALESCE(createdAt, 0) DESC, rowid DESC
    `).all(parentId);
  },

  getConnectionById: (id: string): SyncConnection | null => {
    const row = db.prepare('SELECT * FROM sync_connections WHERE id = ?').get(id) as SyncConnection | undefined;
    return row ? decryptConnection(row) : null;
  },

  deleteConnection: (id: string) => {
    db.prepare("DELETE FROM events WHERE source = 'google' AND parentId = (SELECT parentId FROM sync_connections WHERE id = ?)").run(id);
    db.prepare('DELETE FROM sync_connections WHERE id = ?').run(id);
  },

  updateConnectionTokens: (
    id: string,
    tokens: { accessToken?: string | null; refreshToken?: string | null; appPassword?: string | null },
  ) => {
    const sets: string[] = [];
    const values: Array<string | null> = [];
    const key = getSecretKey();

    if ('accessToken' in tokens) {
      sets.push('accessToken = ?');
      values.push(tokens.accessToken ? encryptField(tokens.accessToken, key) : null);
    }
    if ('refreshToken' in tokens) {
      sets.push('refreshToken = ?');
      values.push(tokens.refreshToken ? encryptField(tokens.refreshToken, key) : null);
    }
    if ('appPassword' in tokens) {
      sets.push('appPassword = ?');
      values.push(tokens.appPassword ? encryptField(tokens.appPassword, key) : null);
    }

    if (sets.length === 0) return false;
    values.push(id);
    const result = db.prepare(`UPDATE sync_connections SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return result.changes > 0;
  },

  refreshGoogleConnectionTokens: async (connection: SyncConnection): Promise<SyncConnection> => {
    if (!connection.refreshToken) {
      throw new Error('Google refresh token is missing');
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2.setCredentials({ refresh_token: connection.refreshToken });
    const { credentials } = await oauth2.refreshAccessToken();
    const newAccessToken = credentials.access_token || connection.accessToken;
    const newRefreshToken = credentials.refresh_token || connection.refreshToken;
    if (!newAccessToken) {
      throw new Error('Google token refresh did not return an access token');
    }

    syncService.updateConnectionTokens(connection.id, {
      accessToken: newAccessToken,
      ...(credentials.refresh_token ? { refreshToken: credentials.refresh_token } : {}),
    });

    return { ...connection, accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  saveGoogleTokens: (parentId: string, accessToken: string, refreshToken?: string | null) => {
    if (!parentId) {
      throw new Error('parentId is required to save Google tokens');
    }
    if (!accessToken) {
      throw new Error('accessToken is required to save Google tokens');
    }

    const existing = db.prepare(
      "SELECT id, refreshToken FROM sync_connections WHERE parentId = ? AND provider = 'google' ORDER BY COALESCE(createdAt, 0) DESC, rowid DESC LIMIT 1"
    ).get(parentId) as { id: string; refreshToken?: string | null } | undefined;

    const now = Date.now();
    const key = getSecretKey();
    const encryptedAccessToken = encryptField(accessToken, key);
    // Encrypt new refreshToken if provided; preserve existing (already-encrypted) value otherwise
    const nextRefreshToken = refreshToken
      ? encryptField(refreshToken, key)
      : (existing?.refreshToken ?? null);

    logger.info({
      parentId,
      hasExistingConnection: Boolean(existing?.id),
      hasRefreshToken: Boolean(refreshToken),
      preservedRefreshToken: !refreshToken && Boolean(existing?.refreshToken),
    }, 'sync_google_tokens_save_start');

    const save = db.transaction(() => {
      if (existing?.id) {
        db.prepare(`
          UPDATE sync_connections
          SET accessToken = ?, refreshToken = ?, createdAt = ?
          WHERE id = ?
        `).run(encryptedAccessToken, nextRefreshToken, now, existing.id);

        // Keep only one active Google connection per parent to prevent duplicate calendar ingestion.
        db.prepare(
          "DELETE FROM sync_connections WHERE parentId = ? AND provider = 'google' AND id != ?"
        ).run(parentId, existing.id);
        return existing.id;
      }

      const connId = `sync_${now}_${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(`
        INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(connId, parentId, 'google', encryptedAccessToken, nextRefreshToken, now);
      return connId;
    });

    const savedConnectionId = save();
    logger.info({
      parentId,
      connectionId: savedConnectionId,
    }, 'sync_google_tokens_save_ok');
  },

  saveManualConnection: (parentId: string, email: string, appPassword: string) => {
    const connId = 'sync_manual_' + Date.now();
    db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, email, appPassword)
      VALUES (?, ?, 'google_manual', ?, ?)
    `).run(connId, parentId, email, encryptField(appPassword, getSecretKey()));
  },

  getActiveGoogleConnection: (parentId: string): SyncConnection | null => {
    const row = db.prepare(
      "SELECT * FROM sync_connections WHERE parentId = ? AND provider = 'google' ORDER BY COALESCE(createdAt, 0) DESC, rowid DESC LIMIT 1"
    ).get(parentId) as SyncConnection | null;
    return row ? decryptConnection(row) : null;
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
    }).catch((e) => {
      logger.error({ parentId, eventId: event.id, error: e }, 'sync_push_failed');
      return null;
    });
  },

  updateEventInGoogle: async (parentId: string, event: CalendarEvent): Promise<void> => {
    if (!event.externalId) return;
    const connection = syncService.getActiveGoogleConnection(parentId);
    if (!connection) return;
    await withTokenRefresh(connection, async (conn) => {
      const calendar = getCalendarClient(conn);
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: toGoogleProviderEventId(event.externalId!),
        requestBody: toGoogleEvent(event),
      });
    }).catch((e) => {
      logger.error({ parentId, eventId: event.id, externalId: event.externalId, error: e }, 'sync_update_failed');
    });
  },

  getSyncCalendars: (connectionId: string) => {
    return db.prepare('SELECT * FROM sync_calendars WHERE connectionId = ?').all(connectionId);
  },

  getSyncCalendarsByParent: (parentId: string) => {
    return db.prepare('SELECT sc.*, sconn.provider FROM sync_calendars sc JOIN sync_connections sconn ON sc.connectionId = sconn.id WHERE sc.parentId = ?').all(parentId);
  },

  getManualConnections: (): Array<{ id: string; parentId: string; email: string; appPassword: string }> => {
    const rows = db.prepare(
      "SELECT * FROM sync_connections WHERE provider = 'google_manual' AND appPassword IS NOT NULL AND email IS NOT NULL"
    ).all() as any[];
    return rows.map(row => ({ ...row, appPassword: decryptField(row.appPassword, getSecretKey()) }));
  },

  getGoogleConnectionsByParent: (parentId: string): SyncConnection[] => {
    const rows = db.prepare(
      "SELECT * FROM sync_connections WHERE parentId = ? AND provider = 'google'"
    ).all(parentId) as SyncConnection[];
    return rows.map(decryptConnection);
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
        eventId: toGoogleProviderEventId(externalId),
      });
    }).catch((e) => {
      logger.error({ parentId, externalId, error: e }, 'sync_delete_failed');
    });
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
        const [googleEventColors, { calendarIds, calendarColorById }] = await Promise.all([
          buildGoogleEventColorMap(calendar),
          fetchAndUpsertCalendars(calendar, conn),
        ]);
        const existingMap = loadExistingGoogleEvents(conn.parentId);
        const stmts: ReconcileStmts = {
          insert: db.prepare('INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source, sourceCalendarId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
          update: db.prepare('UPDATE events SET title = ?, description = ?, startTime = ?, endTime = ?, color = ?, sourceCalendarId = ?, externalId = ? WHERE id = ?'),
        };

        for (const calId of calendarIds) {
          try {
            const res = await calendar.events.list({
              calendarId: calId,
              timeMin: new Date().toISOString(),
              maxResults: 50,
              singleEvents: true,
              orderBy: 'startTime',
            });
            const counts = reconcileCalendarEvents(
              res.data.items ?? [], existingMap, stmts, googleEventColors, calendarColorById, calId, conn.parentId
            );
            imported += counts.imported;
            updated += counts.updated;
            successCount += 1;
          } catch (calErr: unknown) {
            failureCount += 1;
            const msg = calErr instanceof Error ? calErr.message : String(calErr);
            errors.push({ calendarId: calId, message: msg });
            logger.error({ connectionId: conn.id, calendarId: calId, error: msg }, 'sync_calendar_failed');
          }
        }
      });
    } catch (e: unknown) {
      failureCount += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ calendarId: 'connection', message: msg });
      logger.error({ connectionId: connection.id, error: msg }, 'sync_connection_failed');
    }

    const finishedAt = Date.now();
    const status = failureCount === 0 ? 'ok' : successCount > 0 ? 'partial' : 'error';
    persistSyncStatus(connection.id, status);
    return { successCount, failureCount, errors, startedAt, finishedAt, imported, updated };
  },
};
