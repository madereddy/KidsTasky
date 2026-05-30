// src/server/modules/magic/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { magicService } from './service.js';
import { db } from '../../db.js';

vi.mock('./service.js', () => ({
  magicService: {
    parseEventsFromText: vi.fn().mockResolvedValue({
      title: 'Soccer Practice', date: '2026-05-10', startTime: '15:00', location: 'Field A'
    })
  }
}));

process.env.GEMINI_API_KEY = 'test-key';

const MAGIC_PARENT_UID = 'family-123';

describe('Magic Webhook API', () => {
  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Magic Family', 'magic@test.com', ?, 'x')")
      .run(MAGIC_PARENT_UID, MAGIC_PARENT_UID);
  });

  afterEach(() => {
    db.prepare('DELETE FROM events WHERE parentId = ?').run(MAGIC_PARENT_UID);
    db.prepare('DELETE FROM users WHERE uid = ?').run(MAGIC_PARENT_UID);
  });

  it('should process incoming email payload and extract event', async () => {
    // Standard Mailgun/SendGrid style payload text body
    const payload = {
      text: 'Soccer practice Sunday 3pm at Field A',
      recipient: `${MAGIC_PARENT_UID}@import.ourcalendar.app`
    };

    const res = await request(app)
      .post('/api/magic/import')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Soccer Practice');
    expect(magicService.parseEventsFromText).toHaveBeenCalledWith('Soccer practice Sunday 3pm at Field A', 'test-key');

    // Verify real behavior: was it inserted into the database?
    const dbEvent = db.prepare('SELECT * FROM events WHERE title = ? AND parentId = ?').get('Soccer Practice', MAGIC_PARENT_UID) as any;
    expect(dbEvent).toBeDefined();
    expect(dbEvent.title).toBe('Soccer Practice');
  });

  it('rejects import for unknown family', async () => {
    const res = await request(app)
      .post('/api/magic/import')
      .send({ text: 'Some event', recipient: 'nonexistent-family@import.ourcalendar.app' });
    expect(res.status).toBe(404);
  });

  it('rejects import with missing recipient', async () => {
    const res = await request(app)
      .post('/api/magic/import')
      .send({ text: 'Some event' });
    expect(res.status).toBe(400);
  });
});
