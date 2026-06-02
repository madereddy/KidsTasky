// src/server/modules/magic/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { magicService } from './service.js';
import { db } from '../../db.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config.js';

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
  function makeToken(uid: string, role: 'parent' | 'kid', parentId: string) {
    return jwt.sign({ uid, role, parentId }, getJwtSecret(), { expiresIn: '1h' });
  }

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

    const token = makeToken(MAGIC_PARENT_UID, 'parent', MAGIC_PARENT_UID);
    const res = await request(app)
      .post('/api/magic/import')
      .set('Authorization', `Bearer ${token}`)
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
    const token = makeToken(MAGIC_PARENT_UID, 'parent', MAGIC_PARENT_UID);
    const res = await request(app)
      .post('/api/magic/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Some event', recipient: 'nonexistent-family@import.ourcalendar.app' });
    expect(res.status).toBe(404);
  });

  it('blocks a JWT caller importing into another existing family', async () => {
    const otherFamily = 'family-999';
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, passwordHash) VALUES (?, 'parent', 'Other', 'other@test.com', ?, 'x')")
      .run(otherFamily, otherFamily);
    // Caller belongs to family-123 but targets family-999's recipient.
    const token = makeToken(MAGIC_PARENT_UID, 'parent', MAGIC_PARENT_UID);
    const res = await request(app)
      .post('/api/magic/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Injected', recipient: `${otherFamily}@import.ourcalendar.app` });
    expect(res.status).toBe(403);
    const leaked = db.prepare('SELECT COUNT(*) as n FROM events WHERE parentId = ?').get(otherFamily) as any;
    expect(leaked.n).toBe(0);
    db.prepare('DELETE FROM users WHERE uid = ?').run(otherFamily);
  });

  it('rejects import with missing recipient', async () => {
    const token = makeToken(MAGIC_PARENT_UID, 'parent', MAGIC_PARENT_UID);
    const res = await request(app)
      .post('/api/magic/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Some event' });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/magic/import')
      .send({ text: 'Some event', recipient: `${MAGIC_PARENT_UID}@import.ourcalendar.app` });
    expect(res.status).toBe(401);
  });
});
