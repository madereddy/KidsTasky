// src/server/modules/lists/frequentItems.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db.js';
import { listsService } from './service.js';

describe('Frequent Items Tracking', () => {
  const parentId = 'test_parent_freq';
  let listId1: string;
  let listId2: string;

  beforeEach(() => {
    // Clean up
    db.prepare('DELETE FROM item_stats WHERE parentId = ?').run(parentId);
    db.prepare('DELETE FROM list_items WHERE listId IN (SELECT id FROM lists WHERE parentId = ?)').run(parentId);
    db.prepare('DELETE FROM lists WHERE parentId = ?').run(parentId);

    // Setup
    const list1 = listsService.createList(parentId, 'List 1');
    const list2 = listsService.createList(parentId, 'List 2');
    listId1 = list1.id;
    listId2 = list2.id;
  });

  it('should increment usageCount in item_stats when adding items', () => {
    listsService.addItem(listId1, 'Milk');
    listsService.addItem(listId2, 'milk '); // Different casing and trailing space

    const stats = db.prepare('SELECT * FROM item_stats WHERE parentId = ? AND text = ?').get(parentId, 'milk') as any;
    expect(stats).toBeDefined();
    expect(stats.usageCount).toBe(2);
  });

  it('should handle batch adding items and increment usageCount correctly', () => {
    listsService.addItemsToLists([listId1, listId2], 'Eggs');

    const stats = db.prepare('SELECT * FROM item_stats WHERE parentId = ? AND text = ?').get(parentId, 'eggs') as any;
    expect(stats).toBeDefined();
    expect(stats.usageCount).toBe(2);
  });

  it('should return most frequent items that are NOT currently active', () => {
    // Add and then complete/delete items to make them "frequent but not active"
    // Bread: 3 times
    listsService.addItem(listId1, 'Bread');
    listsService.addItem(listId2, 'Bread');
    listsService.addItem(listId1, 'Bread');
    
    // Apples: 2 times
    listsService.addItem(listId1, 'Apples');
    listsService.addItem(listId2, 'Apples');

    // Milk: 1 time
    listsService.addItem(listId1, 'Milk');

    // Initially, all are active, so frequent should be empty
    expect(listsService.getFrequentItems(parentId, 5)).toEqual([]);

    // Now complete all items
    const allItems = db.prepare("SELECT id FROM list_items").all() as {id: string}[];
    allItems.forEach(item => listsService.toggleItem(item.id, true));

    // Now they should all show up in frequent items, sorted by usageCount
    let frequent = listsService.getFrequentItems(parentId, 5);
    expect(frequent).toEqual(['bread', 'apples', 'milk']);

    // If I add 'Bread' back (incomplete), it should disappear from frequent items
    listsService.addItem(listId1, 'Bread');
    frequent = listsService.getFrequentItems(parentId, 5);
    expect(frequent).not.toContain('bread');
    expect(frequent).toEqual(['apples', 'milk']);
  });

  it('should respect the limit parameter', () => {
    // Add and complete items
    listsService.addItem(listId1, 'Item 1');
    listsService.addItem(listId1, 'Item 2');
    listsService.addItem(listId1, 'Item 3');
    
    const allItems = db.prepare("SELECT id FROM list_items").all() as {id: string}[];
    allItems.forEach(item => listsService.toggleItem(item.id, true));

    const frequent = listsService.getFrequentItems(parentId, 2);
    expect(frequent).toHaveLength(2);
  });
});
