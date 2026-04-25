// src/server/modules/photos/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Photos Database Schema', () => {
  it('should allow inserting and fetching a family photo record', () => {
    db.prepare('DELETE FROM family_photos WHERE id = ?').run('photo_1');
    const stmt = db.prepare(`
      INSERT INTO family_photos (id, parentId, url, uploadedAt) 
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run('photo_1', 'parent_1', 'https://example.com/photo.jpg', '2026-04-25T12:00:00Z');
    
    const row = db.prepare('SELECT url FROM family_photos WHERE id = ?').get('photo_1') as any;
    expect(row.url).toBe('https://example.com/photo.jpg');
  });
});
