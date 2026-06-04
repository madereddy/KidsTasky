// src/server/modules/lists/service.ts
import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { AppList, AppListItem } from '../../../types.js';

export const listsService = {
  getLists: (parentId: string): AppList[] => {
    return db.prepare('SELECT * FROM lists WHERE parentId = ?').all(parentId) as AppList[];
  },
  getListById: (id: string): AppList | undefined => {
    return db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as AppList | undefined;
  },
  getListItems: (listId: string): AppListItem[] => {
    return db.prepare('SELECT * FROM list_items WHERE listId = ?').all(listId) as AppListItem[];
  },
  getAllParentItems: (parentId: string): AppListItem[] => {
    return db.prepare(`
      SELECT i.* FROM list_items i 
      JOIN lists l ON i.listId = l.id 
      WHERE l.parentId = ?
    `).all(parentId) as AppListItem[];
  },
  // Family that owns a given list item (via its parent list), or null if missing.
  getItemParentId: (itemId: string): string | null => {
    const row = db.prepare(
      'SELECT l.parentId AS parentId FROM list_items i JOIN lists l ON l.id = i.listId WHERE i.id = ?'
    ).get(itemId) as { parentId: string } | undefined;
    return row?.parentId ?? null;
  },
  createList: (parentId: string, title: string): AppList => {
    const id = randomUUID();
    db.prepare('INSERT INTO lists (id, parentId, title) VALUES (?, ?, ?)').run(id, parentId, title);
    return { id, parentId, title };
  },
  updateList: (id: string, title: string): AppList => {
    db.prepare('UPDATE lists SET title = ? WHERE id = ?').run(title, id);
    const updated = db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as any;
    return { id: updated.id, parentId: updated.parentId, title: updated.title };
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
  toggleItem: (itemId: string, completed: boolean, text?: string) => {
    if (text !== undefined) {
      db.prepare('UPDATE list_items SET completed = ?, text = ? WHERE id = ?').run(completed ? 1 : 0, text, itemId);
    } else {
      db.prepare('UPDATE list_items SET completed = ? WHERE id = ?').run(completed ? 1 : 0, itemId);
    }
  },
  deleteItem: (itemId: string) => {
    db.prepare('DELETE FROM list_items WHERE id = ?').run(itemId);
  },
};
