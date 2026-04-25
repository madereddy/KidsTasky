// src/server/modules/sync/service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { syncService } from './service.js';
import { db } from '../../db.js';

describe('Sync Service', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM sync_connections WHERE parentId = ?').run('test_parent');
    db.prepare('DELETE FROM events WHERE parentId = ?').run('test_parent');
  });

  it('saves google tokens and gets connections', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123', 'refresh_456');

    const list = syncService.getConnections('test_parent') as any[];
    expect(list.length).toBe(1);
    expect(list[0].provider).toBe('google');
  });

  it('deletes connections and associated events', () => {
    syncService.saveGoogleTokens('test_parent', 'access_123');
    const list = syncService.getConnections('test_parent') as any[];
    const connId = list[0].id;

    // Insert fake event
    const evtId = 'evt_test_sync';
    db.prepare('INSERT INTO events (id, parentId, title, startTime, endTime, source) VALUES (?, ?, ?, ?, ?, ?)').run(
      evtId, 'test_parent', 'Google Event', Date.now(), Date.now() + 1000, 'google'
    );

    syncService.deleteConnection(connId);

    const afterList = syncService.getConnections('test_parent') as any[];
    expect(afterList.length).toBe(0);

    const eventCheck = db.prepare('SELECT * FROM events WHERE id = ?').get(evtId);
    expect(eventCheck).toBeUndefined();
  });
});
