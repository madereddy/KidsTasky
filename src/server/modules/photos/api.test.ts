// src/server/modules/photos/api.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { db } from '../../db.js';

describe('Photos API', () => {
  it('should accept photo upload and store ref in db', async () => {
    // Clear out past test
    db.prepare('DELETE FROM family_photos WHERE parentId = ?').run('parent_123');

    const res = await request(app)
      .post('/api/photos/upload')
      .field('parentId', 'parent_123')
      .attach('photo', Buffer.from('fake-image-data'), 'photo.jpg');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    
    // Verify real behavior: stored in database
    const row = db.prepare('SELECT * FROM family_photos WHERE parentId = ?').get('parent_123') as any;
    expect(row).toBeDefined();
    expect(row.url).toBe(res.body.url);
  });
});
