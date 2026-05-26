import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../server.js';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('authenticateUser revokedAt', () => {
  const uid = 'user_revoke_test';
  let token: string;

  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE uid = ?").run(uid);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Test', 'revoke@test.com', ?, 'hash')")
      .run(uid, uid);
    token = jwt.sign({ uid, role: 'parent', parentId: uid }, JWT_SECRET);
  });

  it('allows valid non-revoked token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
  });

  it('rejects revoked token', async () => {
    // Issue token with a known iat (100 seconds ago)
    const issuedAt = Math.floor(Date.now() / 1000) - 100;
    const revokedToken = jwt.sign({ uid, role: 'parent', parentId: uid, iat: issuedAt }, JWT_SECRET);
    // Revoke after token was issued
    db.prepare("UPDATE users SET revokedAt = ? WHERE uid = ?").run(Date.now(), uid);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${revokedToken}`);
    expect(res.status).toBe(401);
  });

  it('allows token issued after revocation', async () => {
    // Revoke, then issue new token
    db.prepare("UPDATE users SET revokedAt = ? WHERE uid = ?").run(Date.now() - 5000, uid);
    const freshToken = jwt.sign({ uid, role: 'parent', parentId: uid }, JWT_SECRET);
    // freshToken.iat = now (in seconds), revokedAt = now-5000ms — fresh token iat*1000 > revokedAt
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${freshToken}`);
    expect(res.status).not.toBe(401);
  });
});
