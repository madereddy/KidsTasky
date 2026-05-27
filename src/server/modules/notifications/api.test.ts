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

  it('unsubscribes without auth (called before logout clears token)', async () => {
    db.prepare("INSERT INTO push_subscriptions (id, userId, parentId, endpoint, p256dh, auth, createdAt) VALUES ('s1', ?, ?, 'https://push.example.com/test', 'abc', 'def', ?)")
      .run(userId, parentId, Date.now());
    const res = await request(app)
      .delete('/api/notifications/subscribe')
      .send({ endpoint: 'https://push.example.com/test' });
    expect(res.status).toBe(200);
    const sub = db.prepare('SELECT * FROM push_subscriptions WHERE userId = ?').get(userId);
    expect(sub).toBeUndefined();
  });
});
