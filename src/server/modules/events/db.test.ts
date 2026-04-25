// src/server/modules/events/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Events Database Schema', () => {
  it('should successfully insert and retrieve an event', () => {
    const stmt = db.prepare(`
      INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run('evt_1', 'parent_1', 'Soccer Practice', 'Bring water', 1713950000, 1713953600, 'kid_1', '#FF0000');
    
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get('evt_1') as any;
    expect(row.title).toBe('Soccer Practice');
    expect(row.color).toBe('#FF0000');
  });
});
