// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, db } from './server';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './src/server/config.js';

describe('WebSockets', () => {
  it('should start websocket server when main server starts', () => {
    // Verify real io instantiation
    const io = app.get('io');
    expect(io).toBeDefined();
    expect(io).toBeInstanceOf(Server);
  });
});

describe('Backend API Tests', () => {
  beforeAll(() => {
    // Tests are using an in-memory SQLite database automatically 
    // initialized by server.ts when NODE_ENV = 'test'.
  });

  beforeEach(() => {
    db.prepare('DELETE FROM completions').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM users').run();
  });

  afterAll(() => {
    db.close();
  });

  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/memory should return runtime and memory diagnostics', async () => {
    const res = await request(app).get('/api/health/memory');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.runtime.pid).toBeTypeOf('number');
    expect(res.body.runtime.node).toBeTypeOf('string');
    expect(res.body.runtime.uptimeSec).toBeTypeOf('number');
    expect(res.body.memory.rssBytes).toBeTypeOf('number');
    expect(res.body.memory.heapUsedBytes).toBeTypeOf('number');
    expect(res.body.memory.rssMb).toBeGreaterThan(0);
    expect(res.body.sockets.connectedUsers).toBeTypeOf('number');
    expect(res.body.sockets.connectedSockets).toBeTypeOf('number');
    expect(res.body.sockets.pendingStaleEmitTimers).toBeTypeOf('number');
  });

  it('GET troubleshooting health endpoints should return diagnostics payloads', async () => {
    const buildRes = await request(app).get('/api/health/build');
    expect(buildRes.status).toBe(200);
    expect(buildRes.body.status).toBe('ok');
    expect(buildRes.body.build.version).toBeTypeOf('string');
    expect(buildRes.body.build.processStartedAt).toBeTypeOf('number');

    const dbRes = await request(app).get('/api/health/db');
    expect(dbRes.status).toBe(200);
    expect(dbRes.body.status).toBe('ok');
    expect(dbRes.body.db.ok).toBe(true);
    expect(dbRes.body.db.latencyMs).toBeTypeOf('number');

    const cacheRes = await request(app).get('/api/health/cache');
    expect(cacheRes.status).toBe(200);
    expect(cacheRes.body.status).toBe('ok');
    expect(Array.isArray(cacheRes.body.caches)).toBe(true);

    const workerRes = await request(app).get('/api/health/worker');
    expect(workerRes.status).toBe(200);
    expect(workerRes.body.status).toBe('ok');
    expect(workerRes.body.worker.active).toBe(false);
    expect(workerRes.body.worker.googleSyncBackoff.failCount).toBeTypeOf('number');

    const depsRes = await request(app).get('/api/health/deps');
    expect(depsRes.status).toBe(200);
    expect(depsRes.body.status).toBe('ok');
    expect(Array.isArray(depsRes.body.dependencies.checks)).toBe(true);

    const requestsRes = await request(app).get('/api/health/requests');
    expect(requestsRes.status).toBe(200);
    expect(requestsRes.body.status).toBe('ok');
    expect(requestsRes.body.requests.total).toBeGreaterThan(0);
    expect(requestsRes.body.requests.byMethod.GET).toBeGreaterThan(0);
  });

  it('POST /api/users (authenticated parent) creates a managed kid and GET retrieves them', async () => {
    // Unauthenticated arbitrary user creation was an account-takeover vector and
    // is no longer allowed — parents register, then mint kids with their token.
    const email = `srv_${Date.now()}@example.com`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'pass1234', name: 'Test Parent' });
    expect([200, 201]).toContain(reg.status);
    const token = reg.body.token as string;

    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ uid: 'kid_srv_123', name: 'Test Kid' });
    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);

    const fetchRes = await request(app).get('/api/users/kid_srv_123')
      .set('Authorization', `Bearer ${token}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.name).toBe('Test Kid');
    expect(fetchRes.body.role).toBe('kid');
  });

  it('rejects unauthenticated user creation without an invite code', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ uid: 'user_takeover', role: 'parent', name: 'Attacker', xp: 150, level: 2 });
    expect(res.status).toBe(401);
  });

  it('POST /api/tasks should create a task', async () => {
    // Create users first
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run('user_123', 'parent', 'Test Parent', 'parent@test.com', 'user_123');
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run('kid_123', 'kid', 'Test Kid', 'kid@test.com', 'user_123');
    const token = jwt.sign({ uid: 'user_123', role: 'parent', parentId: 'user_123' }, getJwtSecret());

    const taskData = {
      title: 'Clean room',
      assignedKidId: 'kid_123',
      parentId: 'user_123',
      frequency: 'daily',
      difficulty: 'medium'
    };

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send(taskData);
      
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    
    // Verify it appeared in the kid's task list
    const fetchRes = await request(app).get('/api/kids/kid_123/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.length).toBe(1);
    expect(fetchRes.body[0].title).toBe('Clean room');
  });

  it('POST /api/categories should create a category and GET should retrieve it', async () => {
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId) VALUES (?, ?, ?, ?, ?)").run('user_123', 'parent', 'Test Parent', 'parent@test.com', 'user_123');
    const token = jwt.sign({ uid: 'user_123', role: 'parent', parentId: 'user_123' }, getJwtSecret());

    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chores',
        icon: 'Broom',
        color: 'gray',
        parentId: 'user_123',
      });
      
    expect(createRes.status).toBe(200);
    expect(createRes.body.id).toBeDefined();
    
    // Verify it appeared in the parent's category list
    const fetchRes = await request(app).get('/api/parents/user_123/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.length).toBe(1);
    expect(fetchRes.body[0].name).toBe('Chores');
  });
});
