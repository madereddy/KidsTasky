// src/server/modules/lists/service.ts
import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { AppList, AppListItem } from '../../../types.js';

export const listsService = {
  getLists: (parentId: string): AppList[] => {
    return db.prepare('SELECT * FROM lists WHERE parentId = ?').all(parentId) as AppList[];
  },
  getListItems: (listId: string): AppListItem[] => {
    return db.prepare('SELECT * FROM list_items WHERE listId = ?').all(listId) as AppListItem[];
  },
  createList: (parentId: string, title: string): AppList => {
    const id = randomUUID();
    db.prepare('INSERT INTO lists (id, parentId, title) VALUES (?, ?, ?)').run(id, parentId, title);
    return { id, parentId, title };
  },
  deleteList: (id: string) => {
    db.prepare('DELETE FROM list_items WHERE listId = ?').run(id);
    db.prepare('DELETE FROM lists WHERE id = ?').run(id);
  },
  addItem: (listId: string, text: string): AppListItem => {
    const id = randomUUID();
    db.prepare('INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, 0)').run(id, listId, text);
    return { id, listId, text, completed: 0 };
  },
  toggleItem: (itemId: string, completed: boolean) => {
    db.prepare('UPDATE list_items SET completed = ? WHERE id = ?').run(completed ? 1 : 0, itemId);
  },
  deleteItem: (itemId: string) => {
    db.prepare('DELETE FROM list_items WHERE id = ?').run(itemId);
  },
};
