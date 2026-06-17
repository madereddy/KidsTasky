import { expect, it, describe, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { socketWrapper } from '../../src/server/socket.js';
import { db } from '../../src/server/db.js';
import jwt from 'jsonwebtoken';

vi.mock('../../src/server/socket.js', () => ({
  socketWrapper: {
    init: vi.fn(),
    emitStaleData: vi.fn(),
    emitToFamily: vi.fn(),
    getDiagnostics: () => ({})
  }
}));

vi.mock('../../src/server/modules/tasks/service.js', () => ({
  taskServiceServer: {
    createTask: vi.fn().mockReturnValue('task-123')
  }
}));

describe('API Boundary and Middleware', () => {
  const jwtSecret = process.env.JWT_SECRET ?? 'test-secret';
  const parentId = 'family-1';
  const token = jwt.sign({ uid: parentId, role: 'parent', parentId }, jwtSecret);

  beforeEach(() => {
    vi.clearAllMocks();
    db.prepare('DELETE FROM users').run();
    db.prepare('INSERT INTO users (uid, role, parentId) VALUES (?, ?, ?)').run(parentId, 'parent', parentId);
  });

  it('should broadcast staleData on authenticated mutations (e.g., tasks)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Task',
        assignedKidId: 'kid-1',
        frequency: 'daily'
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('task-123');
    
    // Verify socket broadcast
    expect(socketWrapper.emitStaleData).toHaveBeenCalledWith(parentId, 'tasks');
  });
});
