// src/server/modules/settings/api.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

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
});
