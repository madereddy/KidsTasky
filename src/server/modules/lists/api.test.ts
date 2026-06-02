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
    getItemParentId: vi.fn().mockReturnValue('parent_qwe'),
    createList: vi.fn().mockReturnValue({ id: 'new_list', parentId: 'parent_qwe', title: 'New' }),
    deleteList: vi.fn(),
    addItem: vi.fn().mockReturnValue({ id: 'new_item', listId: 'list_xyz', text: 'x', completed: 0 }),
    toggleItem: vi.fn(),
    deleteItem: vi.fn(),
  }
}));

import { listsService as mockedListsService } from './service.js';

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

describe('Lists API — cross-family ownership (IDOR)', () => {
  const outsider = 'attacker_fam';
  let outsiderToken: string;

  beforeEach(() => {
    // Service mock always reports list/item owned by 'parent_qwe'.
    outsiderToken = jwt.sign({ uid: outsider, role: 'parent', parentId: outsider }, SECRET);
  });

  it('rejects deleting another family\'s list', async () => {
    const res = await request(app).delete('/api/lists/list_xyz')
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
    expect(mockedListsService.deleteList).not.toHaveBeenCalled();
  });

  it('rejects adding items to another family\'s list', async () => {
    const res = await request(app).post('/api/lists/list_xyz/items')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ text: 'pwn' });
    expect(res.status).toBe(403);
    expect(mockedListsService.addItem).not.toHaveBeenCalled();
  });

  it('rejects toggling another family\'s item', async () => {
    const res = await request(app).put('/api/list-items/item_abc')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ completed: true });
    expect(res.status).toBe(403);
    expect(mockedListsService.toggleItem).not.toHaveBeenCalled();
  });

  it('rejects deleting another family\'s item', async () => {
    const res = await request(app).delete('/api/list-items/item_abc')
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
    expect(mockedListsService.deleteItem).not.toHaveBeenCalled();
  });
});
