// src/server/modules/sync/api.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';
import { syncService } from './service.js';
import { vi } from 'vitest';

describe('Sync API', () => {
  const parentId = 'parent_123';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM sync_calendars WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM sync_connections WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM events WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(parentId, 'parent', 'Test Parent', 'sync@test.com', parentId);
  });

  afterAll(() => {
    // leave cleanup to others
  });

  it('should list connections', async () => {
    db.prepare('INSERT INTO sync_connections (id, parentId, provider, accessToken) VALUES (?, ?, ?, ?)').run(
      'conn_test_1', parentId, 'google', 'token'
    );

    const res = await request(app)
      .get(`/api/settings/${parentId}/connections`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].provider).toBe('google');
  });

  it('should delete connection', async () => {
    db.prepare('INSERT INTO sync_connections (id, parentId, provider, accessToken) VALUES (?, ?, ?, ?)').run(
      'conn_test_2', parentId, 'google', 'token'
    );

    const res = await request(app)
      .delete('/api/settings/connections/conn_test_2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const row = db.prepare('SELECT * FROM sync_connections WHERE id = ?').get('conn_test_2');
    expect(row).toBeUndefined();
  });

  it('lists discovered calendars for a parent', async () => {
    db.prepare('INSERT INTO sync_connections (id, parentId, provider, accessToken) VALUES (?, ?, ?, ?)').run(
      'conn_test_3', parentId, 'google', 'token'
    );
    db.prepare('INSERT INTO sync_calendars (id, connectionId, parentId, calendarId, name, enabled) VALUES (?, ?, ?, ?, ?, ?)').run(
      'cal_test_1', 'conn_test_3', parentId, 'shared@example.com', 'Soccer Schedule', 1
    );

    const res = await request(app)
      .get(`/api/settings/${parentId}/calendars`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cal_test_1', name: 'Soccer Schedule', enabled: 1 })
    ]));
  });

  it('sync-now returns structured response when no connections exist', async () => {
    const res = await request(app)
      .post(`/api/settings/${parentId}/sync-now`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      imported: 0,
      updated: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      connections: 0,
    });
    expect(typeof res.body.startedAt).toBe('number');
    expect(typeof res.body.finishedAt).toBe('number');
  });

  it('granular sync-now route returns SyncNowResult for a specific connection', async () => {
    db.prepare('INSERT INTO sync_connections (id, parentId, provider, accessToken) VALUES (?, ?, ?, ?)').run(
      'conn_test_5', parentId, 'google', 'token'
    );

    const spy = vi.spyOn(syncService, 'syncGoogleConnectionNow').mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      errors: [],
      startedAt: Date.now(),
      finishedAt: Date.now(),
      imported: 0,
      updated: 0,
    });

    const res = await request(app)
      .post('/api/sync/conn_test_5/now')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      successCount: 0,
      failureCount: 0,
      errors: [],
      imported: 0,
      updated: 0,
    });
    expect(typeof res.body.startedAt).toBe('number');
    expect(typeof res.body.finishedAt).toBe('number');

    spy.mockRestore();
  });

  it('toggles a calendar off and removes imported events from that source calendar', async () => {
    db.prepare('INSERT INTO sync_connections (id, parentId, provider, accessToken) VALUES (?, ?, ?, ?)').run(
      'conn_test_4', parentId, 'google', 'token'
    );
    db.prepare('INSERT INTO sync_calendars (id, connectionId, parentId, calendarId, name, enabled) VALUES (?, ?, ?, ?, ?, ?)').run(
      'cal_test_2', 'conn_test_4', parentId, 'shared@example.com', 'Shared Calendar', 1
    );
    db.prepare('INSERT INTO events (id, parentId, title, startTime, endTime, source, sourceCalendarId) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'event_from_disabled_calendar', parentId, 'Shared Event', Date.now(), Date.now() + 1000, 'google', 'shared@example.com'
    );

    const res = await request(app)
      .patch('/api/settings/calendars/cal_test_2')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(db.prepare('SELECT enabled FROM sync_calendars WHERE id = ?').get('cal_test_2')).toEqual({ enabled: 0 });
    expect(db.prepare('SELECT id FROM events WHERE id = ?').get('event_from_disabled_calendar')).toBeUndefined();
  });
});
