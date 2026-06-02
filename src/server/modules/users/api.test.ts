import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import { getJwtSecret } from '../../config.js';

const SECRET = getJwtSecret();

describe('user mutation auth enforcement', () => {
  const parentUid = 'auth_guard_parent';
  const kidUid = 'auth_guard_kid';
  let parentToken: string;
  let kidToken: string;

  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE uid LIKE 'auth_guard%'").run();
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash, badges, xp) VALUES (?, 'parent', 'Parent', 'authp@test.com', ?, 'x', '[]', 0)")
      .run(parentUid, parentUid);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash, badges, xp) VALUES (?, 'kid', 'Kid', null, ?, 'x', '[]', 0)")
      .run(kidUid, parentUid);
    parentToken = jwt.sign({ uid: parentUid, role: 'parent', parentId: parentUid }, SECRET);
    kidToken = jwt.sign({ uid: kidUid, role: 'kid', parentId: parentUid }, SECRET);
  });

  it('rejects unauthenticated badge grant', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/badge`).send({ badgeId: 'star' });
    expect(res.status).toBe(401);
  });

  it('rejects kid granting badge', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/badge`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ badgeId: 'star' });
    expect(res.status).toBe(403);
  });

  it('allows parent to grant badge to own kid', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/badge`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ badgeId: 'star' });
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated XP change', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/xp`).send({ xpChange: 100 });
    expect(res.status).toBe(401);
  });

  it('rejects kid granting XP', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/xp`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ xpChange: 100 });
    expect(res.status).toBe(403);
  });

  it('allows parent to grant XP to own kid', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/xp`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ xpChange: 50 });
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated theme change', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/theme`).send({ themeId: 'space' });
    expect(res.status).toBe(401);
  });

  it('allows kid to change own theme', async () => {
    const res = await request(app).post(`/api/users/${kidUid}/theme`)
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ themeId: 'space' });
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated color change', async () => {
    const res = await request(app).put(`/api/users/${kidUid}/color`).send({ color: '#ff0000' });
    expect(res.status).toBe(401);
  });

  it('allows parent to change kid color', async () => {
    const res = await request(app).put(`/api/users/${kidUid}/color`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ color: '#ff0000' });
    expect(res.status).toBe(200);
  });

  it('rejects cross-family badge grant', async () => {
    // Different family parent tries to grant badge to auth_guard_kid
    const outsiderUid = 'auth_guard_outsider';
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Outsider', 'out@test.com', ?, 'x')")
      .run(outsiderUid, outsiderUid);
    const outsiderToken = jwt.sign({ uid: outsiderUid, role: 'parent', parentId: outsiderUid }, SECRET);
    const res = await request(app).post(`/api/users/${kidUid}/badge`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ badgeId: 'star' });
    expect(res.status).toBe(403);
    db.prepare("DELETE FROM users WHERE uid = ?").run(outsiderUid);
  });
});

describe('POST /users creation guards', () => {
  const parentUid = 'create_guard_parent';
  const otherParentUid = 'create_guard_other';
  let parentToken: string;
  let kidToken: string;

  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE uid LIKE 'create_guard%' OR uid LIKE 'newkid_%'").run();
    db.prepare("INSERT INTO users (uid, role, name, parentId, passwordHash, badges, xp) VALUES (?, 'parent', 'P', ?, 'origHash', '[]', 0)")
      .run(parentUid, parentUid);
    db.prepare("INSERT INTO users (uid, role, name, parentId, passwordHash, badges, xp) VALUES ('create_guard_kid', 'kid', 'K', ?, 'x', '[]', 0)")
      .run(parentUid);
    db.prepare("INSERT INTO users (uid, role, name, parentId, passwordHash, badges, xp) VALUES (?, 'parent', 'O', ?, 'x', '[]', 0)")
      .run(otherParentUid, otherParentUid);
    parentToken = jwt.sign({ uid: parentUid, role: 'parent', parentId: parentUid }, SECRET);
    kidToken = jwt.sign({ uid: 'create_guard_kid', role: 'kid', parentId: parentUid }, SECRET);
  });

  it('rejects unauthenticated kid creation (no invite code)', async () => {
    const res = await request(app).post('/api/users').send({ uid: 'newkid_1', name: 'Hax' });
    expect(res.status).toBe(401);
  });

  it('rejects a kid creating users', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ uid: 'newkid_2', name: 'Hax' });
    expect(res.status).toBe(403);
  });

  it('lets a parent create a managed kid in their own family', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ uid: 'newkid_3', name: 'Cadet', pin: '1234', isManaged: true });
    expect(res.status).toBe(200);
    const kid = db.prepare("SELECT role, parentId FROM users WHERE uid = 'newkid_3'").get() as any;
    expect(kid.role).toBe('kid');
    expect(kid.parentId).toBe(parentUid);
  });

  it('ignores client-supplied parentId/role/xp when a parent creates a kid', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ uid: 'newkid_4', name: 'Cadet', role: 'parent', parentId: otherParentUid, xp: 99999 });
    expect(res.status).toBe(200);
    const kid = db.prepare("SELECT role, parentId, xp FROM users WHERE uid = 'newkid_4'").get() as any;
    expect(kid.role).toBe('kid');           // forced
    expect(kid.parentId).toBe(parentUid);   // forced to caller family
    expect(kid.xp).toBe(0);                  // not trusted from client
  });

  it('does not overwrite an existing account (no INSERT OR REPLACE takeover)', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ uid: parentUid, name: 'Takeover' });
    expect(res.status).toBe(409);
    const row = db.prepare("SELECT passwordHash FROM users WHERE uid = ?").get(parentUid) as any;
    expect(row.passwordHash).toBe('origHash');  // untouched
  });
});

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
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ parentId: ownerUid, parentName: 'Owner', type: 'coparent' });
    expect(res.status).toBe(200);
    expect(res.body.id).toHaveLength(6);
    const inv = db.prepare("SELECT type FROM invites WHERE id = ?").get(res.body.id) as any;
    expect(inv.type).toBe('coparent');
  });

  it('co-parent joins via POST /users with code', async () => {
    // Create co-parent invite
    const invRes = await request(app).post('/api/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
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
