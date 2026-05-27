import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import { getJwtSecret } from '../../config.js';

const SECRET = getJwtSecret();

describe('family notes', () => {
  const parentId = 'notes_test_parent';
  let token: string;

  beforeEach(() => {
    db.prepare('DELETE FROM family_notes WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(parentId);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'TestUser', 'notes@test.com', ?, 'x')")
      .run(parentId, parentId);
    token = jwt.sign({ uid: parentId, role: 'parent', parentId }, SECRET);
  });

  it('returns empty note for new family', async () => {
    const res = await request(app)
      .get(`/api/family-notes/${parentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('');
  });

  it('saves note and retrieves it with updatedByName', async () => {
    await request(app)
      .put(`/api/family-notes/${parentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Remember soccer practice Tuesday!' });

    const res = await request(app)
      .get(`/api/family-notes/${parentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.content).toBe('Remember soccer practice Tuesday!');
    expect(res.body.updatedByName).toBe('TestUser');
  });
});