// src/server/modules/lists/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { listsService } from './service.js';

vi.mock('./service.js', () => ({
  listsService: {
    getLists: vi.fn().mockReturnValue([{ id: 'list_xyz', parentId: 'parent_qwe', title: 'Todos' }]),
    getListItems: vi.fn().mockReturnValue([{ id: 'item_abc', listId: 'list_xyz', text: 'Clean room', completed: 0 }])
  }
}));

describe('Lists API', () => {
  it('should return lists for parent and items for a list', async () => {
    const listRes = await request(app).get('/api/parents/parent_qwe/lists');
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].title).toBe('Todos');

    const itemRes = await request(app).get('/api/lists/list_xyz/items');
    expect(itemRes.status).toBe(200);
    expect(itemRes.body[0].text).toBe('Clean room');
  });
});
