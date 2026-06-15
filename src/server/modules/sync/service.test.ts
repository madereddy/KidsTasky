// src/server/modules/sync/service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const googleCalendarMock = vi.hoisted(() => ({
  colorsGet: vi.fn(),
  calendarListList: vi.fn(),
  eventsList: vi.fn(),
  eventsInsert: vi.fn(),
  eventsPatch: vi.fn(),
  eventsDelete: vi.fn(),
  oauthSetCredentials: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function OAuth2Mock() {
        return {
          setCredentials: googleCalendarMock.oauthSetCredentials,
          refreshAccessToken: googleCalendarMock.refreshAccessToken,
        };
      }),
    },
    calendar: vi.fn(() => ({
      colors: { get: googleCalendarMock.colorsGet },
      calendarList: { list: googleCalendarMock.calendarListList },
      events: {
        list: googleCalendarMock.eventsList,
        insert: googleCalendarMock.eventsInsert,
        patch: googleCalendarMock.eventsPatch,
        delete: googleCalendarMock.eventsDelete,
      },
    })),
  },
}));

import {
  syncService,
  resolveEventColor,
  GOOGLE_EVENT_COLOR_MAP,
  buildLocalGoogleEventId,
  toGoogleProviderEventId,
} from './service.js';
import { db } from '../../db.js';

describe('Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.prepare('DELETE FROM sync_calendars WHERE parentId = ?').run('test_parent');
    db.prepare('DELETE FROM sync_connections WHERE parentId = ?').run('test_parent');
    db.prepare('DELETE FROM events WHERE parentId = ?').run('test_parent');
  });

  it('saves google tokens and gets connections', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');

    const list = syncService.getConnections('test_parent') as any[];
    expect(list.length).toBe(1);
    expect(list[0].provider).toBe('google');
  });

  it('reconnecting same google account updates existing connection instead of creating duplicates', () => {
    syncService.saveGoogleTokens('test_parent', 'access_first', 'refresh_first');
    const [first] = syncService.getConnections('test_parent') as any[];

    syncService.saveGoogleTokens('test_parent', 'access_second', null);
    const list = syncService.getConnections('test_parent') as any[];

    expect(list.length).toBe(1);
    expect(list[0].id).toBe(first.id);

    // Use service layer to get decrypted tokens (raw DB values are now encrypted)
    const full = syncService.getActiveGoogleConnection('test_parent');
    expect(full?.accessToken).toBe('access_second');
    expect(full?.refreshToken).toBe('refresh_first');
  });

  it('updates connection tokens through the encrypted token contract', () => {
    syncService.saveGoogleTokens('test_parent', 'access_first', 'refresh_first');
    const [conn] = syncService.getConnections('test_parent') as any[];

    syncService.updateConnectionTokens(conn.id, {
      accessToken: 'access_refreshed',
      refreshToken: 'refresh_refreshed',
    });

    const raw = db.prepare('SELECT accessToken, refreshToken FROM sync_connections WHERE id = ?').get(conn.id) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(raw.accessToken).not.toBe('access_refreshed');
    expect(raw.refreshToken).not.toBe('refresh_refreshed');

    const decrypted = syncService.getConnectionById(conn.id);
    expect(decrypted?.accessToken).toBe('access_refreshed');
    expect(decrypted?.refreshToken).toBe('refresh_refreshed');
  });

  it('reconnecting removes stale google connections and their sync calendars', () => {
    syncService.saveGoogleTokens('test_parent', 'access_1', 'refresh_1');
    const [conn1] = syncService.getConnections('test_parent') as any[];
    syncService.upsertSyncCalendar(conn1.id, 'test_parent', 'one@example.com', 'One');

    db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken, createdAt)
      VALUES (?, ?, 'google', ?, ?, ?)
    `).run('sync_stale_1', 'test_parent', 'access_stale', 'refresh_stale', Date.now() - 1000);
    syncService.upsertSyncCalendar('sync_stale_1', 'test_parent', 'stale@example.com', 'Stale');

    syncService.saveGoogleTokens('test_parent', 'access_new', 'refresh_new');

    const list = syncService.getConnections('test_parent') as any[];
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(conn1.id);
    const staleCal = db.prepare('SELECT id FROM sync_calendars WHERE connectionId = ?').get('sync_stale_1');
    expect(staleCal).toBeUndefined();
  });

  it('deletes connections and associated events', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123');
    const list = syncService.getConnections('test_parent') as any[];
    const connId = list[0].id;

    // Insert fake event
    const evtId = 'evt_test_sync';
    db.prepare('INSERT INTO events (id, parentId, title, startTime, endTime, source) VALUES (?, ?, ?, ?, ?, ?)').run(
      evtId, 'test_parent', 'Google Event', Date.now(), Date.now() + 1000, 'google'
    );

    syncService.deleteConnection(connId);

    const afterList = syncService.getConnections('test_parent') as any[];
    expect(afterList.length).toBe(0);

    const eventCheck = db.prepare('SELECT * FROM events WHERE id = ?').get(evtId);
    expect(eventCheck).toBeUndefined();
  });

  it('upsertSyncCalendar stores color and isSharedCalendar', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');
    const [conn] = syncService.getConnections('test_parent') as any[];
    syncService.upsertSyncCalendar(conn.id, 'test_parent', 'family@example.com', 'Family Calendar', '#f59e0b', 1);

    const row = db.prepare('SELECT * FROM sync_calendars WHERE calendarId = ?').get('family@example.com') as any;
    expect(row.color).toBe('#f59e0b');
    expect(row.isSharedCalendar).toBe(1);
  });

  it('upsertSyncCalendar works without optional color params', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');
    const [conn] = syncService.getConnections('test_parent') as any[];
    syncService.upsertSyncCalendar(conn.id, 'test_parent', 'personal@example.com', 'My Calendar');

    const row = db.prepare('SELECT * FROM sync_calendars WHERE calendarId = ?').get('personal@example.com') as any;
    expect(row).toBeTruthy();
    expect(row.name).toBe('My Calendar');
  });

  it('upsertSyncCalendar color is returned by getSyncCalendarsByParent', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');
    const [conn] = syncService.getConnections('test_parent') as any[];
    syncService.upsertSyncCalendar(conn.id, 'test_parent', 'colortest@example.com', 'Color Test', '#abc123', 0);

    const cals = syncService.getSyncCalendarsByParent('test_parent') as any[];
    const found = cals.find((c: any) => c.calendarId === 'colortest@example.com');
    expect(found).toBeTruthy();
    expect(found.color).toBe('#abc123');
    expect(found.isSharedCalendar).toBe(0);
  });

  it('imports Google events with a prefixed local id and raw provider externalId', async () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');
    const connection = syncService.getActiveGoogleConnection('test_parent');
    expect(connection).toBeTruthy();

    googleCalendarMock.colorsGet.mockResolvedValue({ data: { event: {} } });
    googleCalendarMock.calendarListList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'primary',
            summary: 'Primary',
            accessRole: 'owner',
            backgroundColor: '#22c55e',
          },
        ],
      },
    });
    googleCalendarMock.eventsList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'google_event_1',
            summary: 'Dentist',
            description: 'Checkup',
            start: { dateTime: '2030-01-01T10:00:00.000Z' },
            end: { dateTime: '2030-01-01T11:00:00.000Z' },
            colorId: '1',
          },
        ],
      },
    });

    const result = await syncService.syncGoogleConnectionNow(connection!);

    expect(result.imported).toBe(1);
    const row = db.prepare('SELECT id, externalId, sourceCalendarId FROM events WHERE parentId = ? AND title = ?').get(
      'test_parent',
      'Dentist',
    ) as { id: string; externalId: string; sourceCalendarId: string } | undefined;
    expect(row).toEqual({
      id: 'ext_google_event_1',
      externalId: 'google_event_1',
      sourceCalendarId: 'primary',
    });
  });

  it('migrates legacy prefixed Google externalIds during import sync', async () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');
    const connection = syncService.getActiveGoogleConnection('test_parent');
    expect(connection).toBeTruthy();

    db.prepare(`
      INSERT INTO events (id, parentId, title, description, startTime, endTime, color, externalId, source, sourceCalendarId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ext_google_event_1',
      'test_parent',
      'Dentist',
      'Checkup',
      Date.parse('2030-01-01T10:00:00.000Z'),
      Date.parse('2030-01-01T11:00:00.000Z'),
      '#a4bdfc',
      'ext_google_event_1',
      'google',
      'primary',
    );

    googleCalendarMock.colorsGet.mockResolvedValue({ data: { event: {} } });
    googleCalendarMock.calendarListList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'primary',
            summary: 'Primary',
            accessRole: 'owner',
            backgroundColor: '#22c55e',
          },
        ],
      },
    });
    googleCalendarMock.eventsList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'google_event_1',
            summary: 'Dentist',
            description: 'Checkup',
            start: { dateTime: '2030-01-01T10:00:00.000Z' },
            end: { dateTime: '2030-01-01T11:00:00.000Z' },
            colorId: '1',
          },
        ],
      },
    });

    const result = await syncService.syncGoogleConnectionNow(connection!);

    expect(result.imported).toBe(0);
    expect(result.updated).toBe(1);
    const rows = db.prepare('SELECT id, externalId FROM events WHERE parentId = ? AND title = ?').all(
      'test_parent',
      'Dentist',
    );
    expect(rows).toEqual([
      {
        id: 'ext_google_event_1',
        externalId: 'google_event_1',
      },
    ]);
  });

  it('sends raw provider ids when updating or deleting legacy-prefixed Google events', async () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');
    googleCalendarMock.eventsPatch.mockResolvedValue({ data: {} });
    googleCalendarMock.eventsDelete.mockResolvedValue({ data: {} });

    await syncService.updateEventInGoogle('test_parent', {
      id: 'local_event',
      parentId: 'test_parent',
      title: 'Updated',
      description: '',
      startTime: Date.parse('2030-01-01T10:00:00.000Z'),
      endTime: Date.parse('2030-01-01T11:00:00.000Z'),
      externalId: 'ext_google_event_1',
    } as any);
    await syncService.deleteEventFromGoogle('test_parent', 'ext_google_event_2');

    expect(googleCalendarMock.eventsPatch).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'google_event_1',
    }));
    expect(googleCalendarMock.eventsDelete).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'google_event_2',
    }));
  });

  it('persists rotated refresh tokens during Google token refresh', async () => {
    syncService.saveGoogleTokens('test_parent', 'access_old', 'refresh_old');
    const [conn] = syncService.getConnections('test_parent') as any[];
    googleCalendarMock.eventsPatch
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: {} });
    googleCalendarMock.refreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'access_rotated',
        refresh_token: 'refresh_rotated',
      },
    });

    await syncService.updateEventInGoogle('test_parent', {
      id: 'local_event',
      parentId: 'test_parent',
      title: 'Updated',
      description: '',
      startTime: Date.parse('2030-01-01T10:00:00.000Z'),
      endTime: Date.parse('2030-01-01T11:00:00.000Z'),
      externalId: 'google_event_1',
    } as any);

    expect(googleCalendarMock.eventsPatch).toHaveBeenCalledTimes(2);
    const raw = db.prepare('SELECT accessToken, refreshToken FROM sync_connections WHERE id = ?').get(conn.id) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(raw.accessToken).not.toBe('access_rotated');
    expect(raw.refreshToken).not.toBe('refresh_rotated');
    const refreshed = syncService.getConnectionById(conn.id);
    expect(refreshed?.accessToken).toBe('access_rotated');
    expect(refreshed?.refreshToken).toBe('refresh_rotated');
  });

  it('toggles sync calendars and deletes events imported from disabled calendars', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');
    const [conn] = syncService.getConnections('test_parent') as any[];
    syncService.upsertSyncCalendar(conn.id, 'test_parent', 'shared@example.com', 'Shared Calendar');

    const [calendar] = syncService.getSyncCalendars(conn.id) as any[];
    db.prepare('INSERT INTO events (id, parentId, title, startTime, endTime, source, sourceCalendarId) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'evt_shared_calendar', 'test_parent', 'Shared Event', Date.now(), Date.now() + 1000, 'google', 'shared@example.com'
    );

    syncService.toggleSyncCalendar(calendar.id, false);

    expect(db.prepare('SELECT enabled FROM sync_calendars WHERE id = ?').get(calendar.id)).toEqual({ enabled: 0 });
    expect(db.prepare('SELECT id FROM events WHERE id = ?').get('evt_shared_calendar')).toBeUndefined();
  });

});

describe('resolveEventColor — color precedence regression', () => {
  it('uses colorId mapping when colorId matches a known Google color', () => {
    const color = resolveEventColor('1', GOOGLE_EVENT_COLOR_MAP, '#f59e0b');
    expect(color).toBe('#a4bdfc');
  });

  it('falls back to calendar color when colorId is absent', () => {
    const color = resolveEventColor(null, GOOGLE_EVENT_COLOR_MAP, '#f59e0b');
    expect(color).toBe('#f59e0b');
  });

  it('falls back to calendar color when colorId has no mapping', () => {
    const color = resolveEventColor('999', GOOGLE_EVENT_COLOR_MAP, '#abc123');
    expect(color).toBe('#abc123');
  });

  it('falls back to default indigo when both colorId and calendar color are absent', () => {
    const color = resolveEventColor(null, GOOGLE_EVENT_COLOR_MAP, undefined);
    expect(color).toBe('#6366f1');
  });

  it('colorId takes precedence over calendar color', () => {
    const color = resolveEventColor('11', GOOGLE_EVENT_COLOR_MAP, '#0000ff');
    expect(color).toBe('#dc2127');
  });

  it('GOOGLE_EVENT_COLOR_MAP covers all 11 standard Google event colors', () => {
    for (let i = 1; i <= 11; i++) {
      expect(GOOGLE_EVENT_COLOR_MAP[String(i)]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('Google event id mapping', () => {
  it('uses prefixed ids locally but raw ids for Google provider calls', () => {
    expect(buildLocalGoogleEventId('google_event_1')).toBe('ext_google_event_1');
    expect(toGoogleProviderEventId('google_event_1')).toBe('google_event_1');
    expect(toGoogleProviderEventId('ext_google_event_1')).toBe('google_event_1');
  });
});
