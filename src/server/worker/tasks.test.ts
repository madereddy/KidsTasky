import { expect, it, describe, beforeEach, vi } from 'vitest';
import { db } from '../db.js';
import { processOverdueTasks, runDailyCleanup, runMidnightEngagementReset } from './tasks.js';

describe('Tasks Worker', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM completions').run();
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM sent_reminders').run();
  });

  it('should create notifications for overdue tasks', async () => {
    const parentId = 'family-1';
    const kidId = 'kid-1';
    db.prepare('INSERT INTO users (uid, role, parentId, name) VALUES (?, ?, ?, ?)').run(parentId, 'parent', parentId, 'Parent');
    db.prepare('INSERT INTO users (uid, role, parentId, name) VALUES (?, ?, ?, ?)').run(kidId, 'kid', parentId, 'Kid');

    // Task due at 00:01 today
    const now = new Date();
    const reminderTime = '00:01';
    
    db.prepare(`
      INSERT INTO tasks (id, parentId, assignedKidId, title, status, frequency, reminderTime, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('task-1', parentId, kidId, 'Overdue Task', 'active', 'daily', reminderTime, Date.now() - 86400000);

    // Force now to be at least 00:02
    vi.setSystemTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 2, 0));

    await processOverdueTasks();

    const notif = db.prepare('SELECT * FROM notifications WHERE taskId = ?').get('task-1') as { type: string } | undefined;
    expect(notif).toBeDefined();
    expect(notif?.type).toBe('overdue');
  });

  it('should cleanup old data', async () => {
    const oldDate = Date.now() - 40 * 24 * 60 * 60 * 1000;
    db.prepare("INSERT INTO notifications (id, parentId, status, createdAt) VALUES (?, ?, ?, ?)").run('old-notif', 'p1', 'read', oldDate);
    
    await runDailyCleanup();
    
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get('old-notif');
    expect(notif).toBeUndefined();
  });

  it('should reset streaks at midnight', async () => {
    const kidId = 'kid-1';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2); // Missed yesterday and day before
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    db.prepare('INSERT INTO users (uid, role, currentStreak, lastMissionDate) VALUES (?, ?, ?, ?)').run(kidId, 'kid', 5, yesterdayStr);
    
    await runMidnightEngagementReset();
    
    const kid = db.prepare('SELECT currentStreak FROM users WHERE uid = ?').get(kidId) as { currentStreak: number } | undefined;
    expect(kid?.currentStreak).toBe(0);
  });
});
