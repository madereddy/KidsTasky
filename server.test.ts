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

  it('POST /api/users should create a user and GET should retrieve them', async () => {
    const createRes = await request(app)
      .post('/api/users')
      .send({ 
        uid: 'user_123', 
        role: 'parent', 
        name: 'Test Parent', 
        email: 'test@example.com',
        xp: 150,
        level: 2
      });
    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    
    const token = jwt.sign({ uid: 'user_123', role: 'parent', parentId: 'user_123' }, getJwtSecret());
    const fetchRes = await request(app).get('/api/users/user_123')
      .set('Authorization', `Bearer ${token}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.name).toBe('Test Parent');
    expect(fetchRes.body.role).toBe('parent');
    expect(fetchRes.body.xp).toBe(150);
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
