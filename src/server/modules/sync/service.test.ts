// src/server/modules/sync/service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { syncService, resolveEventColor, GOOGLE_EVENT_COLOR_MAP } from './service.js';
import { db } from '../../db.js';

describe('Sync Service', () => {
  beforeEach(() => {
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

    const full = db.prepare('SELECT accessToken, refreshToken FROM sync_connections WHERE id = ?').get(first.id) as any;
    expect(full.accessToken).toBe('access_second');
    expect(full.refreshToken).toBe('refresh_first');
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
