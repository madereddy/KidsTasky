// src/server/modules/settings/api.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';
import { settingsService } from './service.js';

import { randomBytes } from 'crypto';

async function createParentAuth() {
  const email = `settings_${Date.now()}_${randomBytes(4).toString('hex')}@example.com`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'pass1234', name: 'Settings Parent' });

  return {
    token: regRes.body.token as string,
    parentId: regRes.body.user.uid as string,
    email,
  };
}

describe('Settings lock API', () => {
  it('returns settings bootstrap payload in one call', async () => {
    const { token, parentId, email } = await createParentAuth();

    db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken, createdAt, lastSyncAt, lastSyncStatus)
      VALUES (?, ?, 'google', 'a', 'r', ?, ?, ?)
    `).run('sync_bootstrap_1', parentId, Date.now(), Date.now(), 'ok');
    db.prepare(`
      INSERT INTO sync_calendars (id, connectionId, parentId, calendarId, name, enabled)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('cal_bootstrap_1', 'sync_bootstrap_1', parentId, 'family@example.com', 'Family');

    const res = await request(app)
      .get(`/api/settings/${parentId}/bootstrap`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.settings.parentId).toBe(parentId);
    expect(Array.isArray(res.body.calendars)).toBe(true);
    expect(Array.isArray(res.body.calendarVisibility)).toBe(true);
    expect(Array.isArray(res.body.connections)).toBe(true);
    expect(res.body.calendars.some((c: any) => c.calendarId === 'family@example.com')).toBe(true);
    expect(res.body.connections.some((c: any) => c.id === 'sync_bootstrap_1')).toBe(true);

    db.prepare('DELETE FROM sync_calendars WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM sync_connections WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });

  it('locks and unlocks display with PIN validation', async () => {
    const { token, parentId, email } = await createParentAuth();

    const saveRes = await request(app)
      .put(`/api/settings/${parentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationLat: 1, locationLon: 2, timezone: 'UTC', pin: '1234', sleepStart: '21:00', sleepEnd: '07:00' });

    expect(saveRes.status).toBe(200);

    const lockRes = await request(app)
      .post(`/api/settings/${parentId}/lock`)
      .set('Authorization', `Bearer ${token}`);
    expect(lockRes.status).toBe(200);

    let row = db.prepare('SELECT isLocked FROM family_settings WHERE parentId = ?').get(parentId) as { isLocked: number };
    expect(row.isLocked).toBe(1);

    const badUnlock = await request(app)
      .post(`/api/settings/${parentId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '9999' });
    expect(badUnlock.status).toBe(403);

    const goodUnlock = await request(app)
      .post(`/api/settings/${parentId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '1234' });
    expect(goodUnlock.status).toBe(200);

    row = db.prepare('SELECT isLocked FROM family_settings WHERE parentId = ?').get(parentId) as { isLocked: number };
    expect(row.isLocked).toBe(0);

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });

  it('allows a parent password to unlock even when a family PIN is set', async () => {
    const { token, parentId, email } = await createParentAuth();

    const saveRes = await request(app)
      .put(`/api/settings/${parentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationLat: 1, locationLon: 2, timezone: 'UTC', pin: '1234', sleepStart: '21:00', sleepEnd: '07:00' });

    expect(saveRes.status).toBe(200);

    const lockRes = await request(app)
      .post(`/api/settings/${parentId}/lock`)
      .set('Authorization', `Bearer ${token}`);
    expect(lockRes.status).toBe(200);

    const unlockRes = await request(app)
      .post(`/api/settings/${parentId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: 'pass1234' });
    expect(unlockRes.status).toBe(200);

    const row = db.prepare('SELECT isLocked FROM family_settings WHERE parentId = ?').get(parentId) as { isLocked: number };
    expect(row.isLocked).toBe(0);

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });

  it('allows a parent password to unlock when no family PIN is set', async () => {
    const { token, parentId, email } = await createParentAuth();

    settingsService.saveSettings(parentId, {
      locationLat: 1,
      locationLon: 2,
      timezone: 'UTC',
      sleepStart: '21:00',
      sleepEnd: '07:00',
    });

    const lockRes = await request(app)
      .post(`/api/settings/${parentId}/lock`)
      .set('Authorization', `Bearer ${token}`);
    expect(lockRes.status).toBe(200);

    const unlockRes = await request(app)
      .post(`/api/settings/${parentId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: 'pass1234' });
    expect(unlockRes.status).toBe(200);

    const row = db.prepare('SELECT isLocked FROM family_settings WHERE parentId = ?').get(parentId) as { isLocked: number };
    expect(row.isLocked).toBe(0);

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });
});

describe('Settings write is parent-only', () => {
  async function setup() {
    const { token, parentId, email } = await createParentAuth();
    const kidUid = `settings_kid_${randomBytes(4).toString('hex')}`;
    db.prepare("INSERT INTO users (uid, role, name, parentId, passwordHash, badges, xp) VALUES (?, 'kid', 'K', ?, 'x', '[]', 0)")
      .run(kidUid, parentId);
    const kidToken = jwt.sign({ uid: kidUid, role: 'kid', parentId }, getJwtSecret());
    return { token, kidToken, parentId, email, kidUid };
  }

  it('rejects a kid changing family settings (e.g. PIN)', async () => {
    const { kidToken, parentId, email, kidUid } = await setup();
    const res = await request(app)
      .put(`/api/settings/${parentId}`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ pin: '0000' });
    expect(res.status).toBe(403);
    db.prepare('DELETE FROM users WHERE uid = ? OR email = ?').run(kidUid, email);
  });

  it('rejects a kid locking/unlocking the display', async () => {
    const { kidToken, parentId, email, kidUid } = await setup();
    const lockRes = await request(app)
      .post(`/api/settings/${parentId}/lock`)
      .set('Authorization', `Bearer ${kidToken}`);
    expect(lockRes.status).toBe(403);

    const unlockRes = await request(app)
      .post(`/api/settings/${parentId}/unlock`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ pin: '1234' });
    expect(unlockRes.status).toBe(403);
    db.prepare('DELETE FROM users WHERE uid = ? OR email = ?').run(kidUid, email);
  });
});
