// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, db } from '../../../../server.js';
import { getJwtSecret } from '../../config.js';

describe('Homework API', () => {
  const parentId = 'parent_hw_1';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());
  const otherParentId = 'parent_hw_2';
  const otherParentToken = jwt.sign({ uid: otherParentId, role: 'parent', parentId: otherParentId }, getJwtSecret());
  const kidA = 'kid_hw_a';
  const kidB = 'kid_hw_b';
  const kidAToken = jwt.sign({ uid: kidA, role: 'kid', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM homework').run();
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(otherParentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(kidA);
    db.prepare('DELETE FROM users WHERE uid = ?').run(kidB);
    db.prepare('INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)')
      .run(parentId, 'parent', 'Parent', 'hw@test.com', parentId);
    db.prepare('INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)')
      .run(otherParentId, 'parent', 'Other Parent', 'other-hw@test.com', otherParentId);
    db.prepare('INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)')
      .run(kidA, 'kid', 'Kid A', 'kida@test.com', parentId);
    db.prepare('INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)')
      .run(kidB, 'kid', 'Kid B', 'kidb@test.com', parentId);
  });

  it('creates and retrieves homework', async () => {
    const create = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Math worksheet', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1' });
    expect(create.status).toBe(200);
    expect(create.body.id).toBeTruthy();

    const list = await request(app)
      .get(`/api/parents/${parentId}/homework`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('Math worksheet');
  });

  it('allows parent to create, update, and delete homework', async () => {
    const create = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Reading', subject: 'English', dueDate: '2026-06-01', color: '#6366f1' });
    const id = create.body.id as string;

    const patch = await request(app)
      .patch(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'done' });
    expect(patch.status).toBe(200);

    const del = await request(app)
      .delete(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });

  it('forbids kid create and delete; allows own status update only', async () => {
    const kidCreate = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${kidAToken}`)
      .send({ title: 'Kid create', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1' });
    expect(kidCreate.status).toBe(403);

    const create = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Assigned to B', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1', assignedToId: kidB });
    const id = create.body.id as string;

    const kidPatch = await request(app)
      .patch(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${kidAToken}`)
      .send({ status: 'done' });
    expect(kidPatch.status).toBe(403);

    const ownCreate = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Assigned to A', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1', assignedToId: kidA });
    const ownId = ownCreate.body.id as string;
    const ownPatch = await request(app)
      .patch(`/api/homework/${ownId}`)
      .set('Authorization', `Bearer ${kidAToken}`)
      .send({ status: 'done' });
    expect(ownPatch.status).toBe(200);

    const kidDelete = await request(app)
      .delete(`/api/homework/${ownId}`)
      .set('Authorization', `Bearer ${kidAToken}`);
    expect(kidDelete.status).toBe(403);
  });

  it('forbids kid from editing non-status fields on own assignment', async () => {
    const create = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Original', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1', assignedToId: kidA });
    const id = create.body.id as string;

    const kidPatch = await request(app)
      .patch(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${kidAToken}`)
      .send({ title: 'Tampered', status: 'done' });
    expect(kidPatch.status).toBe(200);

    const list = await request(app)
      .get(`/api/parents/${parentId}/homework`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body[0].title).toBe('Original');
    expect(list.body[0].status).toBe('done');
  });

  it('forbids non-family parent from homework updates', async () => {
    const create = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Math worksheet', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1' });
    const id = create.body.id as string;

    const patch = await request(app)
      .patch(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${otherParentToken}`)
      .send({ status: 'done' });
    expect(patch.status).toBe(404);
  });

  it('forbids cross-family reads of parent homework', async () => {
    await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Math worksheet', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1' });

    const list = await request(app)
      .get(`/api/parents/${parentId}/homework`)
      .set('Authorization', `Bearer ${otherParentToken}`);
    expect(list.status).toBe(403);
  });

  it('rejects invalid homework status values', async () => {
    const create = await request(app)
      .post('/api/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Math worksheet', subject: 'Math', dueDate: '2026-06-01', color: '#6366f1' });
    const id = create.body.id as string;

    const patch = await request(app)
      .patch(`/api/homework/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid' });
    expect(patch.status).toBe(400);
  });
});
