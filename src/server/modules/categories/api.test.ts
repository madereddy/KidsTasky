// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, db } from '../../../../server.js';
import { getJwtSecret } from '../../config.js';

describe('Categories API', () => {
  const parentId = 'categories_parent_test';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());
  const kidToken = jwt.sign({ uid: 'categories_kid_test', role: 'kid', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM categories WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, 'parent', 'Cat Parent', 'cat@test.com', ?)").run(parentId, parentId);
  });

  it('allows a parent to create a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Chores', icon: '🧹', color: 'bg-blue-500', parentId });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
  });

  it('forbids a kid from creating, editing, or deleting categories', async () => {
    const create = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ name: 'Kid Cat', icon: '🎮', color: 'bg-blue-500', parentId });
    expect(create.status).toBe(403);

    // Seed a real category to attempt edit/delete against.
    const seeded = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Real', icon: '🏠', color: 'bg-blue-500', parentId });
    const id = seeded.body.id as string;

    const edit = await request(app)
      .put(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ name: 'Hacked', icon: '🏠', color: 'bg-blue-500', parentId });
    expect(edit.status).toBe(403);

    const del = await request(app)
      .delete(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${kidToken}`);
    expect(del.status).toBe(403);
  });
});
