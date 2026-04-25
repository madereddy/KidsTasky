// src/server/modules/settings/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Settings and Sync Schema', () => {
  it('should insert and retrieve family settings', () => {
    const stmt = db.prepare(`
      INSERT INTO family_settings (parentId, locationLat, locationLon, timezone) 
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('parent_1', 40.7128, -74.0060, 'America/New_York');
    
    const row = db.prepare('SELECT * FROM family_settings WHERE parentId = ?').get('parent_1') as any;
    expect(row.locationLat).toBe(40.7128);
  });

  it('should insert and retrieve sync connections', () => {
    const stmt = db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run('sync_1', 'parent_1', 'google', 'access_123', 'refresh_123');
    
    const row = db.prepare('SELECT * FROM sync_connections WHERE id = ?').get('sync_1') as any;
    expect(row.provider).toBe( 'google');
  });
});
