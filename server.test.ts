// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, db } from './server';
import { Server } from 'socket.io';

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
    
    const fetchRes = await request(app).get('/api/users/user_123');
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.name).toBe('Test Parent');
    expect(fetchRes.body.role).toBe('parent');
    expect(fetchRes.body.xp).toBe(150);
  });

  it('POST /api/tasks should create a task', async () => {
    const taskData = {
      title: 'Clean room',
      assignedKidId: 'kid_123',
      parentId: 'user_123',
      frequency: 'daily',
      difficulty: 'medium'
    };

    const res = await request(app)
      .post('/api/tasks')
      .send(taskData);
      
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    
    // Verify it appeared in the kid's task list
    const fetchRes = await request(app).get('/api/kids/kid_123/tasks');
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.length).toBe(1);
    expect(fetchRes.body[0].title).toBe('Clean room');
  });

  it('POST /api/categories should create a category and GET should retrieve it', async () => {
    const createRes = await request(app)
      .post('/api/categories')
      .send({
        name: 'Chores',
        icon: 'Broom',
        color: 'gray',
        parentId: 'user_123',
      });
      
    expect(createRes.status).toBe(200);
    expect(createRes.body.id).toBeDefined();
    
    // Verify it appeared in the parent's category list
    const fetchRes = await request(app).get('/api/parents/user_123/categories');
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.length).toBe(1);
    expect(fetchRes.body[0].name).toBe('Chores');
  });
});
