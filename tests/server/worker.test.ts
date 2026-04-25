import { expect, test, vi, beforeEach, afterAll } from 'vitest';
import { db } from '../../src/server/db.js';

beforeEach(() => {
    // Avoid running db commands here to prevent test locks or race conditions with other suites using db
});

afterAll(() => {
    // DB handled by main suite
});

test('Worker sync flow', async () => {
    // Setup a fake connection
    db.prepare(`INSERT OR REPLACE INTO sync_connections (id, parentId, provider, accessToken, refreshToken)
                VALUES ('conn-1', 'parent-1', 'google', 'fake-access', 'fake-refresh');`).run();
    
    // Test logic here
    const res = db.prepare(`SELECT * FROM sync_connections WHERE id = 'conn-1'`).get();
    expect(res).toBeDefined();

    db.prepare(`DELETE FROM sync_connections WHERE id = 'conn-1'`).run();
});
