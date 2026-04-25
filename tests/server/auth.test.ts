import { expect, test } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { db } from '../../src/server/db.js';

test('Registration and Login flow', async () => {
  // Register
  const regRes = await request(app).post('/api/auth/register').send({ email: 'test@example.com', password: 'pass', name: 'Tester' });
  expect(regRes.status).toBe(200);
  expect(regRes.body.token).toBeDefined();

  // Login
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'pass' });
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toBeDefined();
  
  // Me
  const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginRes.body.token}`);
  expect(meRes.status).toBe(200);
  expect(meRes.body.user.email).toBe('test@example.com');
  
  db.prepare("DELETE FROM users WHERE email = ?").run('test@example.com');
});
