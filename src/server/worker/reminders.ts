import { db } from '../db.js';
import { sendPushToUser } from '../modules/notifications/pushService.js';
import { sendEmail } from '../modules/notifications/emailService.js';
import { runWithConcurrency } from './utils.js';
import { markWorkerJobStart, markWorkerJobSuccess, markWorkerJobFailure } from './diagnostics.js';
import { logger } from '../lib/logger.js';

export const REMINDER_WINDOW_MS = 60_000;

export async function sendEventReminders() {
  const startedAt = markWorkerJobStart('eventReminders');
  try {
    const getReminderSentStmt = db.prepare('SELECT 1 FROM sent_reminders WHERE eventId = ? AND reminderMinutes = ?');
    const insertReminderSentStmt = db.prepare('INSERT OR IGNORE INTO sent_reminders (eventId, reminderMinutes, sentAt) VALUES (?, ?, ?)');
    const getFamilyMembersStmt = db.prepare('SELECT uid, email FROM users WHERE parentId = ? OR uid = ?');
    const now = Date.now();
    
    const events = db.prepare(`
      SELECT e.id, e.title, e.startTime, e.reminderMinutes, e.parentId,
             fs.timezone as familyTimezone
      FROM events e
      JOIN family_settings fs ON e.parentId = fs.parentId
      WHERE e.reminderMinutes IS NOT NULL
        AND e.startTime > ?
    `).all(now - REMINDER_WINDOW_MS) as any[];
    
    const familyMembersCache = new Map<string, Array<{ uid: string; email?: string }>>();

    for (const event of events) {
      const reminderMs = Number(event.reminderMinutes) * 60 * 1000;
      const fireAt = Number(event.startTime) - reminderMs;
      if (Math.abs(now - fireAt) > REMINDER_WINDOW_MS) continue;

      const already = getReminderSentStmt.get(event.id, event.reminderMinutes);
      if (already) continue;

      insertReminderSentStmt.run(event.id, event.reminderMinutes, now);

      const title = `Reminder: ${event.title}`;
      const body = Number(event.reminderMinutes) === 0
        ? 'Starting now'
        : `Starting in ${event.reminderMinutes} minute${Number(event.reminderMinutes) !== 1 ? 's' : ''}`;
      const payload = { title, body, tag: `event-${event.id}` };

      let members = familyMembersCache.get(event.parentId);
      if (!members) {
        members = getFamilyMembersStmt.all(event.parentId, event.parentId) as Array<{ uid: string; email?: string }>;
        familyMembersCache.set(event.parentId, members);
      }
      await runWithConcurrency(members, async (member) => {
        const pushed = await sendPushToUser(member.uid, payload);
        if (!pushed && member.email) {
          await sendEmail(member.email, title, body);
        }
      });
    }
    markWorkerJobSuccess('eventReminders', startedAt);
  } catch (e) {
    markWorkerJobFailure('eventReminders', startedAt, e);
    logger.error({ error: e }, 'worker_event_reminder_error');
    throw e;
  }
}
