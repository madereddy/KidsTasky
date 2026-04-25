// src/server/modules/magic/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
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

describe('Magic Webhook API', () => {
  it('should process incoming email payload and extract event', async () => {
    // Clean up any old test data
    db.prepare('DELETE FROM events WHERE title = ?').run('Soccer Practice');

    // Standard Mailgun/SendGrid style payload text body
    const payload = {
      text: 'Soccer practice Sunday 3pm at Field A',
      recipient: 'family-123@import.ourcalendar.app'
    };

    const res = await request(app)
      .post('/api/magic/import')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Soccer Practice');
    expect(magicService.parseEventsFromText).toHaveBeenCalledWith('Soccer practice Sunday 3pm at Field A', 'test-key');

    // Verify real behavior: was it inserted into the database?
    const dbEvent = db.prepare('SELECT * FROM events WHERE title = ? AND parentId = ?').get('Soccer Practice', 'family-123') as any;
    expect(dbEvent).toBeDefined();
    expect(dbEvent.title).toBe('Soccer Practice');
  });
});
