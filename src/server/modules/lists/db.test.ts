// src/server/modules/lists/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Lists Database Schema', () => {
  it('should create and retrieve a list with items', () => {
    const listStmt = db.prepare(`INSERT INTO lists (id, parentId, title) VALUES (?, ?, ?)`);
    listStmt.run('list_1', 'parent_lists_1', 'Groceries');
    
    const itemStmt = db.prepare(`INSERT INTO list_items (id, listId, text, completed) VALUES (?, ?, ?, ?)`);
    itemStmt.run('item_1', 'list_1', 'Milk', 0);
    
    const listRow = db.prepare('SELECT * FROM lists WHERE id = ?').get('list_1') as any;
    const itemRow = db.prepare('SELECT * FROM list_items WHERE listId = ?').get('list_1') as any;
    
    expect(listRow.title).toBe('Groceries');
    expect(itemRow.text).toBe('Milk');
    expect(itemRow.completed).toBe(0);
  });
});
