import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

const SECRET = process.env.JWT_SECRET || 'test-secret';

describe('co-parent flow', () => {
  const ownerUid = 'owner_cp_test';
  let ownerToken: string;

  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE uid LIKE 'owner_cp%' OR uid LIKE 'cp_new%'").run();
    db.prepare("DELETE FROM invites WHERE parentId = ?").run(ownerUid);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Owner', 'owner@cp.test', ?, 'x')")
      .run(ownerUid, ownerUid);
    ownerToken = jwt.sign({ uid: ownerUid, role: 'parent', parentId: ownerUid }, SECRET);
  });

  it('creates co-parent invite via type param', async () => {
    const res = await request(app).post('/api/invites')
      .send({ parentId: ownerUid, parentName: 'Owner', type: 'coparent' });
    expect(res.status).toBe(200);
    expect(res.body.id).toHaveLength(6);
    const inv = db.prepare("SELECT type FROM invites WHERE id = ?").get(res.body.id) as any;
    expect(inv.type).toBe('coparent');
  });

  it('co-parent joins via POST /users with code', async () => {
    // Create co-parent invite
    const invRes = await request(app).post('/api/invites')
      .send({ parentId: ownerUid, parentName: 'Owner', type: 'coparent' });
    const code = invRes.body.id;

    // Join using POST /users with the code
    const joinRes = await request(app).post('/api/users')
      .send({ uid: 'cp_new_1', name: 'CoParent', email: 'cop@test.com', code, password: 'password123' });
    expect(joinRes.status).toBe(200);
    const newUid = joinRes.body.uid;

    const user = db.prepare("SELECT role, parentId FROM users WHERE uid = ?").get(newUid) as any;
    expect(user.role).toBe('parent');
    expect(user.parentId).toBe(ownerUid);
  });

  it('rejects invalid co-parent code', async () => {
    const res = await request(app).post('/api/users')
      .send({ uid: 'cp_new_2', name: 'Bad', email: 'bad@test.com', code: 'BADCOD', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('lists and removes co-parent', async () => {
    // Add co-parent directly
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES ('cp_new_3', 'parent', 'CP3', 'cp3@test.com', ?, 'x')")
      .run(ownerUid);

    // List
    const listRes = await request(app).get(`/api/parents/${ownerUid}/coparents`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((c: any) => c.uid === 'cp_new_3')).toBe(true);

    // Remove
    const delRes = await request(app).delete(`/api/users/cp_new_3/coparent`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(delRes.status).toBe(200);
    const user = db.prepare("SELECT revokedAt, parentId FROM users WHERE uid = 'cp_new_3'").get() as any;
    expect(user.revokedAt).toBeTruthy();
    expect(user.parentId).toBeNull();
  });
});
