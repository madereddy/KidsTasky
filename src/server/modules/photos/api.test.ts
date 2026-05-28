// src/server/modules/photos/api.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

import { randomBytes } from 'crypto';

async function createParentAuth() {
  const email = `photos_${Date.now()}_${randomBytes(4).toString('hex')}@example.com`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'pass1234', name: 'Photo Parent' });

  return {
    token: regRes.body.token as string,
    parentId: regRes.body.user.uid as string,
    email,
  };
}

function seedGoogleConnection(parentId: string) {
  db.prepare(`
    INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken, createdAt)
    VALUES (?, ?, 'google', ?, ?, ?)
  `).run(
    `sync_test_${Date.now()}_${randomBytes(3).toString('hex')}`,
    parentId,
    'test_access_token',
    'test_refresh_token',
    Date.now()
  );
}

describe('Photos API', () => {
  it('uploads photo, updates caption, lists, and deletes', async () => {
    const { token, parentId, email } = await createParentAuth();

    const uploadRes = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake-image-data'), 'photo.jpg');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body).toHaveProperty('id');
    expect(uploadRes.body).toHaveProperty('url');

    const photoId = uploadRes.body.id as string;

    const capRes = await request(app)
      .put(`/api/photos/${photoId}/caption`)
      .set('Authorization', `Bearer ${token}`)
      .send({ caption: 'Beach day' });

    expect(capRes.status).toBe(200);
    expect(capRes.body.success).toBe(true);

    const listRes = await request(app)
      .get(`/api/parents/${parentId}/photos`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((p: any) => p.id === photoId && p.caption === 'Beach day')).toBe(true);

    const delRes = await request(app)
      .delete(`/api/photos/${photoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const row = db.prepare('SELECT id FROM family_photos WHERE id = ?').get(photoId) as { id: string } | undefined;
    expect(row).toBeUndefined();

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });

  it('imports picker-selected photo items into family photos', async () => {
    const { token, parentId, email } = await createParentAuth();
    seedGoogleConnection(parentId);

    const importRes = await request(app)
      .post(`/api/parents/${parentId}/google-photos/picker/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: 'session-test-1',
        items: [
          { id: 'm1', baseUrl: 'https://lh3.googleusercontent.com/test-photo-1' },
          { id: 'm2', baseUrl: 'https://lh3.googleusercontent.com/test-photo-2=w800-h600' },
        ],
      });

    expect(importRes.status).toBe(200);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.imported).toBe(2);

    const listRes = await request(app)
      .get(`/api/parents/${parentId}/photos`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThanOrEqual(2);
    expect(listRes.body.some((p: any) => String(p.url).includes('test-photo-1'))).toBe(true);

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });

  it('dedupes picker imports and reports skipped count', async () => {
    const { token, parentId, email } = await createParentAuth();
    seedGoogleConnection(parentId);

    const payload = {
      sessionId: 'session-test-2',
      items: [
        { id: 'm1', baseUrl: 'https://lh3.googleusercontent.com/test-photo-dedupe' },
      ],
    };

    const first = await request(app)
      .post(`/api/parents/${parentId}/google-photos/picker/import`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.status).toBe(200);
    expect(first.body.imported).toBe(1);
    expect(first.body.skipped).toBe(0);

    const second = await request(app)
      .post(`/api/parents/${parentId}/google-photos/picker/import`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body.imported).toBe(0);
    expect(second.body.skipped).toBe(1);

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });
});
