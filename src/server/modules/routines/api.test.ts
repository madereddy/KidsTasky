// src/server/modules/routines/api.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';

describe('Routines API', () => {
  const parentId = 'routines_parent_test';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM routine_templates WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run(parentId, 'parent', 'Test Parent', 'routines@test.com', parentId);
  });

  it('forbids a kid from creating or deleting routine templates', async () => {
    const kidToken = jwt.sign({ uid: 'routines_kid_test', role: 'kid', parentId }, getJwtSecret());
    const create = await request(app)
      .post(`/api/parents/${parentId}/routines`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ title: 'Kid Routine', defaultStartTime: '08:00', color: '#f59e0b' });
    expect(create.status).toBe(403);

    db.prepare('INSERT INTO routine_templates (id, parentId, title, defaultDuration, createdAt) VALUES (?, ?, ?, ?, ?)').run(
      'rt_kid_del', parentId, 'Delete Me', 3600000, Date.now()
    );
    const del = await request(app)
      .delete('/api/routines/rt_kid_del')
      .set('Authorization', `Bearer ${kidToken}`);
    expect(del.status).toBe(403);
  });

  it('creates a routine template', async () => {
    const res = await request(app)
      .post(`/api/parents/${parentId}/routines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'School Pickup', defaultStartTime: '15:30', color: '#f59e0b' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();

    const row = db.prepare('SELECT * FROM routine_templates WHERE id = ?').get(res.body.id) as any;
    expect(row.title).toBe('School Pickup');
    expect(row.defaultStartTime).toBe('15:30');
    expect(row.color).toBe('#f59e0b');
  });

  it('lists routine templates for a parent', async () => {
    db.prepare('INSERT INTO routine_templates (id, parentId, title, defaultDuration, createdAt) VALUES (?, ?, ?, ?, ?)').run(
      'rt_1', parentId, 'Trash Day', 3600000, Date.now()
    );

    const res = await request(app)
      .get(`/api/parents/${parentId}/routines`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'rt_1', title: 'Trash Day' }),
    ]));
  });

  it('deletes a routine template', async () => {
    db.prepare('INSERT INTO routine_templates (id, parentId, title, defaultDuration, createdAt) VALUES (?, ?, ?, ?, ?)').run(
      'rt_del', parentId, 'Delete Me', 3600000, Date.now()
    );

    const res = await request(app)
      .delete('/api/routines/rt_del')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(db.prepare('SELECT id FROM routine_templates WHERE id = ?').get('rt_del')).toBeUndefined();
  });

  it('rejects creating a routine for another parent', async () => {
    const otherToken = jwt.sign({ uid: 'other_parent', role: 'parent', parentId: 'other_parent' }, getJwtSecret());
    const res = await request(app)
      .post(`/api/parents/${parentId}/routines`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hijacked Routine' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post(`/api/parents/${parentId}/routines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultStartTime: '09:00' });

    expect(res.status).toBe(400);
  });
});
