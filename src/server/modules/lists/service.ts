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
  getListsByIds: (ids: string[]): AppList[] => {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    return db.prepare(`SELECT * FROM lists WHERE id IN (${placeholders})`).all(...ids) as AppList[];
  },
  getListItems: (listId: string): AppListItem[] => {
    return db.prepare('SELECT * FROM list_items WHERE listId = ?').all(listId) as AppListItem[];
  },
  getItemById: (itemId: string): AppListItem | undefined => {
    return db.prepare('SELECT * FROM list_items WHERE id = ?').get(itemId) as AppListItem | undefined;
  },
  getAllParentItems: (parentId: string): AppListItem[] => {
    return db.prepare(`
      SELECT i.* FROM list_items i 
      JOIN lists l ON i.listId = l.id 
      WHERE l.parentId = ?
    `).all(parentId) as AppListItem[];
  },
  getItemParentId: (itemId: string): string | null => {
    const row = db.prepare(
      'SELECT l.parentId AS parentId FROM list_items i JOIN lists l ON l.id = i.listId WHERE i.id = ?'
    ).get(itemId) as { parentId: string } | undefined;
    return row?.parentId ?? null;
  },
  createList: (parentId: string, title: string, category: 'shopping' | 'routine' = 'routine', isRoutine: number = 0, locationName?: string): AppList => {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO lists (id, parentId, title, category, isRoutine, locationName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, parentId, title, category, isRoutine, locationName || null, now, now);
    
    return {
      id,
      parentId,
      title,
      category,
      isRoutine,
      locationName,
      createdAt: now,
      updatedAt: now
    };
  },
  updateList: (id: string, title?: string, category?: 'shopping' | 'routine', isRoutine?: number, locationName?: string): AppList => {
    const now = new Date().toISOString();
    const current = db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as any;
    if (!current) throw new Error('List not found');

    const newTitle = title !== undefined ? title : current.title;
    const newCategory = category !== undefined ? category : current.category;
    const newIsRoutine = isRoutine !== undefined ? isRoutine : current.isRoutine;
    const newLocationName = locationName !== undefined ? locationName : current.locationName;

    db.prepare(`
      UPDATE lists 
      SET title = ?, category = ?, isRoutine = ?, locationName = ?, updatedAt = ?
      WHERE id = ?
    `).run(newTitle, newCategory, newIsRoutine, newLocationName || null, now, id);

    const updated = db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as any;
    return {
      id: updated.id,
      parentId: updated.parentId,
      title: updated.title,
      category: updated.category as 'shopping' | 'routine',
      isRoutine: updated.isRoutine,
      locationName: updated.locationName,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  },
  deleteList: (id: string) => {
    db.prepare('DELETE FROM list_items WHERE listId = ?').run(id);
    db.prepare('DELETE FROM lists WHERE id = ?').run(id);
  },
  addItem: (listId: string, text: string, storeName?: string, locationName?: string): AppListItem => {
    const id = randomUUID();
    db.prepare('INSERT INTO list_items (id, listId, text, completed, storeName, locationName) VALUES (?, ?, ?, 0, ?, ?)').run(id, listId, text, storeName || null, locationName || null);

    const list = listsService.getListById(listId);
    if (list) {
      db.prepare(`
        INSERT INTO item_stats (parentId, text, usageCount) 
        VALUES (?, ?, 1)
        ON CONFLICT(parentId, text) DO UPDATE SET usageCount = usageCount + 1
      `).run(list.parentId, text.toLowerCase().trim());
    }

    return { id, listId, text, completed: 0, storeName, locationName };
  },
  addItemsToLists: (listIds: string[], text: string, storeName?: string, locationName?: string): AppListItem[] => {
    const uniqueListIds = Array.from(new Set(listIds.filter(Boolean)));
    if (uniqueListIds.length === 0) return [];

    const lists = listsService.getListsByIds(uniqueListIds);
    if (lists.length === 0) return [];

    const parentId = lists[0].parentId;
    const normalizedText = text.toLowerCase().trim();
    const insertItem = db.prepare('INSERT INTO list_items (id, listId, text, completed, storeName, locationName) VALUES (?, ?, ?, 0, ?, ?)');

    const updateStats = db.prepare(`
      INSERT INTO item_stats (parentId, text, usageCount)
      VALUES (?, ?, ?)
      ON CONFLICT(parentId, text) DO UPDATE SET usageCount = usageCount + excluded.usageCount
    `);

    const transaction = db.transaction((ids: string[]) => {
      const items = ids.map((listId) => {
        const id = randomUUID();
        insertItem.run(id, listId, text, storeName || null, locationName || null);
        return { id, listId, text, completed: 0, storeName, locationName } as AppListItem;
      });

      if (parentId) {
        updateStats.run(parentId, normalizedText, ids.length);
      }

      return items;
    });

    return transaction(uniqueListIds);
  },
  copyItemToLists: (itemId: string, listIds: string[]): AppListItem[] => {
    const item = db.prepare('SELECT * FROM list_items WHERE id = ?').get(itemId) as AppListItem | undefined;
    if (!item) throw new Error('Item not found');
    return listsService.addItemsToLists(listIds, item.text, item.storeName, item.locationName);
  },
  moveItemToList: (itemId: string, targetListId: string): AppListItem => {
    db.prepare('UPDATE list_items SET listId = ? WHERE id = ?').run(targetListId, itemId);
    const updated = db.prepare('SELECT * FROM list_items WHERE id = ?').get(itemId) as AppListItem | undefined;
    if (!updated) throw new Error('Item not found');
    return updated;
  },
  toggleItem: (itemId: string, completed: boolean, text?: string, storeName?: string, locationName?: string) => {
    const now = Date.now();
    const current = db.prepare('SELECT * FROM list_items WHERE id = ?').get(itemId) as any;
    if (!current) return;

    const newText = text !== undefined ? text : current.text;
    const newStoreName = storeName !== undefined ? storeName : current.storeName;
    const newLocationName = locationName !== undefined ? locationName : current.locationName;
    const newCompletedAt = completed && !current.completed ? now : (completed ? current.completedAt : null);

    db.prepare(`
      UPDATE list_items 
      SET completed = ?, text = ?, storeName = ?, locationName = ?, completedAt = ? 
      WHERE id = ?
    `).run(completed ? 1 : 0, newText, newStoreName || null, newLocationName || null, newCompletedAt, itemId);
  },
  deleteItem: (itemId: string) => {
    db.prepare('DELETE FROM list_items WHERE id = ?').run(itemId);
  },
  getFrequentItems: (parentId: string, limit = 5): string[] => {
    const rows = db.prepare(`
      SELECT text FROM item_stats 
      WHERE parentId = ? 
      AND text NOT IN (
        SELECT LOWER(TRIM(li.text))
        FROM list_items li
        JOIN lists l ON li.listId = l.id
        WHERE l.parentId = ? AND li.completed = 0
      )
      ORDER BY usageCount DESC 
      LIMIT ?
    `).all(parentId, parentId, limit) as { text: string }[];
    return rows.map(r => r.text);
  },
};
