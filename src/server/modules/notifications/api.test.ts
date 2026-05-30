import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { db } from '../../db.js';
import { getJwtSecret } from '../../config.js';

const SECRET = getJwtSecret();

describe('push subscription endpoints', () => {
  const userId = 'push_test_user';
  const parentId = 'push_test_parent';
  let token: string;

  beforeEach(() => {
    db.prepare('DELETE FROM push_subscriptions WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM users WHERE uid = ?').run(userId);
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Test', 'push@test.com', ?, 'x')")
      .run(userId, parentId);
    token = jwt.sign({ uid: userId, role: 'parent', parentId }, SECRET);
  });

  it('returns vapid public key', async () => {
    const res = await request(app).get('/api/notifications/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publicKey');
  });

  it('subscribes a push endpoint', async () => {
    const res = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/test', p256dh: 'abc123', auth: 'def456' });
    expect(res.status).toBe(200);
    const sub = db.prepare('SELECT * FROM push_subscriptions WHERE userId = ?').get(userId);
    expect(sub).toBeTruthy();
  });

  it('unsubscribes with auth token (called before logout clears token)', async () => {
    db.prepare("INSERT INTO push_subscriptions (id, userId, parentId, endpoint, p256dh, auth, createdAt) VALUES ('s1', ?, ?, 'https://push.example.com/test', 'abc', 'def', ?)")
      .run(userId, parentId, Date.now());
    const res = await request(app)
      .delete('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/test' });
    expect(res.status).toBe(200);
    const sub = db.prepare('SELECT * FROM push_subscriptions WHERE userId = ?').get(userId);
    expect(sub).toBeUndefined();
  });

  it('rejects unauthenticated unsubscribe', async () => {
    const res = await request(app)
      .delete('/api/notifications/subscribe')
      .send({ endpoint: 'https://push.example.com/test' });
    expect(res.status).toBe(401);
  });

  it('does not delete another user subscription with same endpoint', async () => {
    db.prepare("INSERT INTO users (uid, role, name, email, parentId, passwordHash) VALUES ('other_push_user', 'parent', 'Other', 'other_push@test.com', 'other_push_user', 'x')").run();
    db.prepare("INSERT INTO push_subscriptions (id, userId, parentId, endpoint, p256dh, auth, createdAt) VALUES ('s_other', 'other_push_user', 'other_push_user', 'https://push.example.com/other', 'abc', 'def', ?)").run(Date.now());
    const res = await request(app)
      .delete('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/other' });
    expect(res.status).toBe(200);
    // other user's sub still exists
    const sub = db.prepare('SELECT * FROM push_subscriptions WHERE id = ?').get('s_other');
    expect(sub).toBeTruthy();
    db.prepare("DELETE FROM users WHERE uid = 'other_push_user'").run();
    db.prepare("DELETE FROM push_subscriptions WHERE id = 's_other'").run();
  });
});
