// src/server/modules/settings/features.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Settings Schema Extension for Lock and Sleep', () => {
  it('should allow inserting pin, sleepStart, and sleepEnd into family_settings', () => {
    // Delete if exists
    db.prepare('DELETE FROM family_settings WHERE parentId = ?').run('parent_ext_1');
    const stmt = db.prepare(`
      INSERT INTO family_settings (parentId, locationLat, locationLon, timezone, pin, sleepStart, sleepEnd) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Testing specific lock config: 1234, sleep from 22:00 to 06:00
    stmt.run('parent_ext_1', 0, 0, 'UTC', '1234', '22:00', '06:00');
    
    const row = db.prepare('SELECT pin, sleepStart, sleepEnd FROM family_settings WHERE parentId = ?').get('parent_ext_1') as any;
    expect(row.pin).toBe('1234');
    expect(row.sleepStart).toBe('22:00');
    expect(row.sleepEnd).toBe('06:00');
  });
});
