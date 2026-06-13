import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../db.js';
import { sendEventReminders } from './reminders.js';
import * as pushService from '../modules/notifications/pushService.js';
import * as emailService from '../modules/notifications/emailService.js';

vi.mock('../modules/notifications/pushService.js');
vi.mock('../modules/notifications/emailService.js');

describe('Event Reminders Worker', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM sent_reminders').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM family_settings').run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send reminders for upcoming events', async () => {
    const parentId = 'family-1';
    const kidId = 'kid-1';
    
    db.prepare('INSERT INTO users (uid, role, parentId, email) VALUES (?, ?, ?, ?)').run(parentId, 'parent', parentId, 'parent@test.com');
    db.prepare('INSERT INTO users (uid, role, parentId, email) VALUES (?, ?, ?, ?)').run(kidId, 'kid', parentId, 'kid@test.com');
    db.prepare('INSERT INTO family_settings (parentId, timezone) VALUES (?, ?)').run(parentId, 'UTC');

    const now = Date.now();
    const startTime = now + 15 * 60 * 1000; // 15 mins from now
    const eventId = 'event-1';
    
    db.prepare(`
      INSERT INTO events (id, parentId, title, startTime, reminderMinutes)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventId, parentId, 'Test Event', startTime, 15);

    const pushSpy = vi.spyOn(pushService, 'sendPushToUser').mockResolvedValue(true);

    await sendEventReminders();

    expect(pushSpy).toHaveBeenCalled();
    const sent = db.prepare('SELECT 1 FROM sent_reminders WHERE eventId = ? AND reminderMinutes = ?').get(eventId, 15);
    expect(sent).toBeDefined();
  });
});
