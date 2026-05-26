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
});
