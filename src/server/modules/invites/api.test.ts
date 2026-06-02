// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, db } from '../../../../server.js';
import { getJwtSecret } from '../../config.js';

describe('Invites API', () => {
  const parentId = 'invites_parent_test';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, getJwtSecret());
  const kidToken = jwt.sign({ uid: 'invites_kid_test', role: 'kid', parentId }, getJwtSecret());

  beforeEach(() => {
    db.prepare('DELETE FROM invites WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, 'parent', 'Invite Parent', 'invite@test.com', ?)").run(parentId, parentId);
  });

  it('allows a parent to create an invite', async () => {
    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ parentId, parentName: 'Invite Parent', type: 'kid' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
  });

  it('forbids a kid from minting invites (incl. co-parent escalation)', async () => {
    const kidInvite = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ parentId, parentName: 'Invite Parent', type: 'kid' });
    expect(kidInvite.status).toBe(403);

    const coparentInvite = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ parentId, parentName: 'Invite Parent', type: 'coparent' });
    expect(coparentInvite.status).toBe(403);
  });
});
