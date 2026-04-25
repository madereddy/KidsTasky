// src/server/modules/lists/service.ts
import { db } from '../../db.js';
import { AppList, AppListItem } from '../../../types.js';

export const listsService = {
  getLists: (parentId: string): AppList[] => {
    return db.prepare('SELECT * FROM lists WHERE parentId = ?').all(parentId) as AppList[];
  },
  getListItems: (listId: string): AppListItem[] => {
    return db.prepare('SELECT * FROM list_items WHERE listId = ?').all(listId) as AppListItem[];
  }
};
