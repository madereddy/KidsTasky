// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { app } from '../../server.js';
import { db } from './db.js';

describe('perf health route', () => {
  it('returns aggregated latency buckets for hot routes', async () => {
    const email = `perf_${Date.now()}_${randomBytes(4).toString('hex')}@example.com`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'pass1234', name: 'Perf Parent' });

    expect(register.status).toBe(200);
    const token = register.body.token as string;
    const parentId = register.body.user.uid as string;

    await request(app)
      .get(`/api/settings/${parentId}`)
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .get(`/api/parents/${parentId}/events`)
      .set('Authorization', `Bearer ${token}`);

    const perf = await request(app).get('/api/health/perf');
    expect(perf.status).toBe(200);
    expect(perf.body.routes['GET /api/settings/*']?.count).toBeGreaterThan(0);
    expect(perf.body.routes['GET /api/parents/:parentId/events']?.count).toBeGreaterThan(0);

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  });
});
