// src/server/modules/flags/api.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';

describe('Feature Flags API', () => {
  const parentId = 'flags_parent_test';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM feature_flags WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(
      parentId, 'parent', 'Test Parent', 'flags@test.com', parentId
    );
  });

  it('GET returns all known flags defaulting to enabled=true', async () => {
    const res = await request(app)
      .get(`/api/settings/${parentId}/flags`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.wall_v2_layout).toBe(true);
    expect(res.body.sync_diagnostics).toBe(true);
    expect(res.body.calendar_visibility_profiles).toBe(true);
  });

  it('PATCH disables a flag and GET reflects it', async () => {
    const patchRes = await request(app)
      .patch(`/api/settings/${parentId}/flags/wall_v2_layout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.flag).toBe('wall_v2_layout');
    expect(patchRes.body.enabled).toBe(false);

    const getRes = await request(app)
      .get(`/api/settings/${parentId}/flags`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.wall_v2_layout).toBe(false);
    // Other flags still default to true
    expect(getRes.body.sync_diagnostics).toBe(true);
  });

  it('PATCH re-enables a previously disabled flag (rollback)', async () => {
    await request(app)
      .patch(`/api/settings/${parentId}/flags/sync_diagnostics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });

    const rollbackRes = await request(app)
      .patch(`/api/settings/${parentId}/flags/sync_diagnostics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });

    expect(rollbackRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/settings/${parentId}/flags`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.sync_diagnostics).toBe(true);
  });

  it('PATCH returns 400 for unknown flag', async () => {
    const res = await request(app)
      .patch(`/api/settings/${parentId}/flags/nonexistent_flag`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });

    expect(res.status).toBe(400);
  });

  it('PATCH returns 400 when enabled is not boolean', async () => {
    const res = await request(app)
      .patch(`/api/settings/${parentId}/flags/wall_v2_layout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: 'yes' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when accessing another parent flags', async () => {
    const otherToken = jwt.sign({ uid: 'other_parent', role: 'parent', parentId: 'other_parent' }, getJwtSecret());

    const getRes = await request(app)
      .get(`/api/settings/${parentId}/flags`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/settings/${parentId}/flags/wall_v2_layout`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ enabled: false });
    expect(patchRes.status).toBe(403);
  });

  it('all three Phase E flags can be independently toggled', async () => {
    const flags: Array<'wall_v2_layout' | 'sync_diagnostics' | 'calendar_visibility_profiles'> = [
      'wall_v2_layout',
      'sync_diagnostics',
      'calendar_visibility_profiles',
    ];

    for (const flag of flags) {
      const off = await request(app)
        .patch(`/api/settings/${parentId}/flags/${flag}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: false });
      expect(off.status).toBe(200);
    }

    const getRes = await request(app)
      .get(`/api/settings/${parentId}/flags`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.wall_v2_layout).toBe(false);
    expect(getRes.body.sync_diagnostics).toBe(false);
    expect(getRes.body.calendar_visibility_profiles).toBe(false);
  });
});
