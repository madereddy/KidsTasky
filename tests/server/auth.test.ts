import { expect, test } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { db } from '../../src/server/db.js';

test('Registration and Login flow', async () => {
  // Register
  const regRes = await request(app).post('/api/auth/register').send({ email: 'test@example.com', password: 'password123', name: 'Tester' });
  expect(regRes.status).toBe(200);
  expect(regRes.body.token).toBeDefined();

  // Login
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'password123' });
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toBeDefined();
  
  // Me
  const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginRes.body.token}`);
  expect(meRes.status).toBe(200);
  expect(meRes.body.user.email).toBe('test@example.com');
  
  db.prepare("DELETE FROM users WHERE email = ?").run('test@example.com');
});

test('Kid PIN login and profile discovery', async () => {
  // 1. Setup Parent
  const parentEmail = 'parent@example.com';
  await request(app).post('/api/auth/register').send({ email: parentEmail, password: 'password123', name: 'Parent' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: parentEmail, password: 'password123' });
  const token = loginRes.body.token;
  const parentId = loginRes.body.user.uid;

  // 2. Create Managed Kid
  const kidUid = 'test_kid_123';
  await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
    uid: kidUid,
    name: 'Managed Kid',
    role: 'kid',
    parentId: parentId,
    isManaged: true,
    pin: '1234'
  });

  // 3. Discover profiles via parent email
  const profileRes = await request(app).get(`/api/auth/profiles/${encodeURIComponent(parentEmail)}`);
  expect(profileRes.status).toBe(200);
  expect(profileRes.body.kids).toHaveLength(1);
  expect(profileRes.body.kids[0].name).toBe('Managed Kid');

  // 4. Kid PIN login
  const kidLoginRes = await request(app).post('/api/auth/login/kid').send({
    uid: kidUid,
    pin: '1234'
  });
  expect(kidLoginRes.status).toBe(200);
  expect(kidLoginRes.body.token).toBeDefined();
  expect(kidLoginRes.body.user.role).toBe('kid');

  // 5. Cleanup
  db.prepare("DELETE FROM users WHERE parentId = ? OR uid = ?").run(parentId, parentId);
});
