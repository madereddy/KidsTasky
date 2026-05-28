// src/server/modules/lists/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { listsService } from './service.js';
import { getJwtSecret } from '../../config.js';

const SECRET = getJwtSecret();

vi.mock('./service.js', () => ({
  listsService: {
    getLists: vi.fn().mockReturnValue([{ id: 'list_xyz', parentId: 'parent_qwe', title: 'Todos' }]),
    getListItems: vi.fn().mockReturnValue([{ id: 'item_abc', listId: 'list_xyz', text: 'Clean room', completed: 0 }]),
    getListById: vi.fn().mockReturnValue({ id: 'list_xyz', parentId: 'parent_qwe', title: 'Todos' }),
  }
}));

describe('Lists API', () => {
  const parentId = 'parent_qwe';
  let token: string;

  beforeEach(() => {
    token = jwt.sign({ uid: parentId, role: 'parent', parentId }, SECRET);
  });

  it('should return lists for parent and items for a list', async () => {
    const listRes = await request(app).get('/api/parents/parent_qwe/lists')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].title).toBe('Todos');

    const itemRes = await request(app).get('/api/lists/list_xyz/items')
      .set('Authorization', `Bearer ${token}`);
    expect(itemRes.status).toBe(200);
    expect(itemRes.body[0].text).toBe('Clean room');
  });
});
