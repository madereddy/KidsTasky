import { expect, test } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { db } from '../../src/server/db.js';
import { decryptField } from '../../src/server/lib/crypto.js';
import { getSecretKey } from '../../src/server/config.js';

test('Manual sync connection', async () => {
  // 1. Setup Parent
  const parentEmail = 'parent_sync@example.com';
  await request(app).post('/api/auth/register').send({ email: parentEmail, password: 'password', name: 'Parent' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: parentEmail, password: 'password' });
  const token = loginRes.body.token;
  const parentId = loginRes.body.user.uid;

  // 2. Connect manual
  const syncRes = await request(app)
    .post('/api/sync/connect/manual')
    .set('Authorization', `Bearer ${token}`)
    .send({ email: 'test@gmail.com', appPassword: 'abcd efgh ijkl mnop' });

  expect(syncRes.status).toBe(200);
  expect(syncRes.body.success).toBe(true);

  // 3. Verify in DB
  const conn = db.prepare("SELECT * FROM sync_connections WHERE parentId = ? AND provider = 'google_manual'").get(parentId) as any;
  expect(conn).toBeDefined();
  expect(conn.email).toBe('test@gmail.com');
  expect(decryptField(conn.appPassword, getSecretKey())).toBe('abcd efgh ijkl mnop');

  // 4. Cleanup
  db.prepare("DELETE FROM sync_connections WHERE parentId = ?").run(parentId);
  db.prepare("DELETE FROM users WHERE uid = ?").run(parentId);
});
