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
    getLists: vi.fn().mockReturnValue([{
      id: 'list_xyz',
      parentId: 'parent_qwe',
      title: 'Todos',
      category: 'routine',
      isRoutine: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]),
    getListItems: vi.fn().mockReturnValue([{ id: 'item_abc', listId: 'list_xyz', text: 'Clean room', completed: 0 }]),
    getListById: vi.fn().mockReturnValue({
      id: 'list_xyz',
      parentId: 'parent_qwe',
      title: 'Todos',
      category: 'routine',
      isRoutine: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    getListsByIds: vi.fn().mockReturnValue([
      {
        id: 'list_xyz',
        parentId: 'parent_qwe',
        title: 'Todos',
        category: 'routine',
        isRoutine: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'list_abc',
        parentId: 'parent_qwe',
        title: 'Soccer',
        category: 'routine',
        isRoutine: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]),
    getItemById: vi.fn().mockReturnValue({ id: 'item_abc', listId: 'list_xyz', text: 'Clean room', completed: 0 }),
    getItemParentId: vi.fn().mockReturnValue('parent_qwe'),
    createList: vi.fn().mockReturnValue({
      id: 'new_list',
      parentId: 'parent_qwe',
      title: 'New',
      category: 'routine',
      isRoutine: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    deleteList: vi.fn(),
    addItem: vi.fn().mockReturnValue({ id: 'new_item', listId: 'list_xyz', text: 'x', completed: 0 }),
    addItemsToLists: vi.fn().mockReturnValue([
      { id: 'new_item_1', listId: 'list_xyz', text: 'x', completed: 0 },
      { id: 'new_item_2', listId: 'list_abc', text: 'x', completed: 0 },
    ]),
    copyItemToLists: vi.fn().mockReturnValue([
      { id: 'copied_item', listId: 'list_abc', text: 'Clean room', completed: 0 },
    ]),
    moveItemToList: vi.fn().mockReturnValue({ id: 'item_abc', listId: 'list_abc', text: 'Clean room', completed: 0 }),
    toggleItem: vi.fn(),
    deleteItem: vi.fn(),
  }
}));

import { listsService as mockedListsService } from './service.js';

describe('Lists API', () => {
  const parentId = 'parent_qwe';
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('adds the same item to multiple lists', async () => {
    const res = await request(app).post('/api/list-items/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ listIds: ['list_xyz', 'list_abc'], text: 'Water bottle' });

    expect(res.status).toBe(201);
    expect(mockedListsService.getListsByIds).toHaveBeenCalledWith(['list_xyz', 'list_abc']);
    expect(mockedListsService.addItemsToLists).toHaveBeenCalledWith(['list_xyz', 'list_abc'], 'Water bottle', undefined, undefined);
    expect(res.body).toHaveLength(2);
  });

  it('copies an existing item to another list', async () => {
    vi.mocked(mockedListsService.getListsByIds).mockReturnValueOnce([{
      id: 'list_abc',
      parentId: 'parent_qwe',
      title: 'Soccer',
      category: 'routine',
      isRoutine: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]);
    const res = await request(app).post('/api/list-items/item_abc/copy')
      .set('Authorization', `Bearer ${token}`)
      .send({ listIds: ['list_abc'] });

    expect(res.status).toBe(201);
    expect(mockedListsService.copyItemToLists).toHaveBeenCalledWith('item_abc', ['list_abc']);
  });

  it('moves an existing item to another list', async () => {
    const res = await request(app).post('/api/list-items/item_abc/move')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetListId: 'list_abc' });

    expect(res.status).toBe(200);
    expect(mockedListsService.moveItemToList).toHaveBeenCalledWith('item_abc', 'list_abc');
  });
});

describe('Lists API — cross-family ownership (IDOR)', () => {
  const outsider = 'attacker_fam';
  let outsiderToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('rejects batch-adding to another family\'s lists', async () => {
    const res = await request(app).post('/api/list-items/batch')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ listIds: ['list_xyz', 'list_abc'], text: 'pwn' });
    expect(res.status).toBe(403);
    expect(mockedListsService.addItemsToLists).not.toHaveBeenCalled();
  });

  it('rejects copying an item to another family\'s lists', async () => {
    const res = await request(app).post('/api/list-items/item_abc/copy')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ listIds: ['list_abc'] });
    expect(res.status).toBe(403);
    expect(mockedListsService.copyItemToLists).not.toHaveBeenCalled();
  });

  it('rejects moving an item to another family\'s list', async () => {
    const res = await request(app).post('/api/list-items/item_abc/move')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ targetListId: 'list_abc' });
    expect(res.status).toBe(403);
    expect(mockedListsService.moveItemToList).not.toHaveBeenCalled();
  });

  it('rejects deleting another family\'s item', async () => {
    const res = await request(app).delete('/api/list-items/item_abc')
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
    expect(mockedListsService.deleteItem).not.toHaveBeenCalled();
  });
});
