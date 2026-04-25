// src/server/modules/sync/api.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

describe('Sync API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM sync_connections WHERE parentId = ?').run('parent_123');
  });

  afterAll(() => {
    // leave cleanup to others
  });

  it('should list connections', async () => {
    db.prepare('INSERT INTO sync_connections (id, parentId, provider, accessToken) VALUES (?, ?, ?, ?)').run(
      'conn_test_1', 'parent_123', 'google', 'token'
    );

    const res = await request(app).get('/api/settings/parent_123/connections');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].provider).toBe('google');
  });

  it('should delete connection', async () => {
    db.prepare('INSERT INTO sync_connections (id, parentId, provider, accessToken) VALUES (?, ?, ?, ?)').run(
      'conn_test_2', 'parent_123', 'google', 'token'
    );

    const res = await request(app).delete('/api/settings/connections/conn_test_2');

    expect(res.status).toBe(200);
    
    const row = db.prepare('SELECT * FROM sync_connections WHERE id = ?').get('conn_test_2');
    expect(row).toBeUndefined();
  });
});
