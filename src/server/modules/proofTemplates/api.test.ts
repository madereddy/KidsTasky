// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, db } from '../../../../server.js';
import { getJwtSecret } from '../../config.js';

describe('Proof Templates API', () => {
  const parentId = 'parent_templates_1';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM proof_templates WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare('INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)').run(
      parentId,
      'parent',
      'Template Parent',
      'template-parent@test.com',
      parentId
    );
  });

  it('forbids a kid from creating proof templates', async () => {
    const kidToken = jwt.sign({ uid: 'templates_kid_1', role: 'kid', parentId }, getJwtSecret());
    const res = await request(app)
      .post('/api/proof-templates/task')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ name: 'Kid Template', questions: ['Q1'], pinned: false });
    expect(res.status).toBe(403);
  });

  it('creates, lists, pins, imports and deletes templates', async () => {
    const create = await request(app)
      .post('/api/proof-templates/task')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Room Cleanup', questions: ['Q1', 'Q2'], pinned: false });
    expect(create.status).toBe(200);
    expect(create.body.name).toBe('Room Cleanup');

    const list = await request(app)
      .get('/api/proof-templates/task')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    const id = list.body[0].id as string;

    const pin = await request(app)
      .patch(`/api/proof-templates/task/${id}/pin`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pinned: true });
    expect(pin.status).toBe(200);

    const importRes = await request(app)
      .post('/api/proof-templates/task/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ templates: [{ name: 'Kitchen Help', questions: ['Q3'], pinned: true }] });
    expect(importRes.status).toBe(200);
    expect(importRes.body.imported).toBe(1);

    const listAfterImport = await request(app)
      .get('/api/proof-templates/task')
      .set('Authorization', `Bearer ${token}`);
    expect(listAfterImport.body.length).toBe(2);

    const remove = await request(app)
      .delete(`/api/proof-templates/task/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remove.status).toBe(200);
  });

  it('supports reusable list-item templates', async () => {
    const create = await request(app)
      .post('/api/proof-templates/list')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Soccer Bottle', questions: ['Water Bottle @ Soccer Field'], pinned: true });
    expect(create.status).toBe(200);
    expect(create.body.kind).toBe('list');

    const list = await request(app)
      .get('/api/proof-templates/list')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body[0].name).toBe('Soccer Bottle');
  });
});
