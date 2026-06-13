import { format, parse, isAfter, startOfDay, differenceInDays } from 'date-fns';
import { db } from '../db.js';
import type { Server as SocketServer } from 'socket.io';
import { markWorkerJobStart, markWorkerJobSuccess, markWorkerJobFailure } from './diagnostics.js';
import { logger } from '../lib/logger.js';

export async function processOverdueTasks(io?: SocketServer) {
  const startedAt = markWorkerJobStart('overdueTasks');
  logger.info({}, 'worker_overdue_tasks_start');
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    
    const tasks = db.prepare("SELECT * FROM tasks WHERE status = 'active'").all() as any[];
    const dueTasks = tasks.filter((task) => !!task.reminderTime);
    if (dueTasks.length === 0) {
      markWorkerJobSuccess('overdueTasks', startedAt);
      return;
    }

    const taskIdToTask = new Map<string, any>(tasks.map((t) => [t.id, t]));
    const kidIds = Array.from(new Set(dueTasks.map((t) => t.assignedKidId).filter(Boolean)));
    const kidNameById = new Map<string, string>(
      kidIds.length === 0
        ? []
        : (db.prepare(
          `SELECT uid, name FROM users WHERE uid IN (${kidIds.map(() => '?').join(',')})`
        ).all(...kidIds) as Array<{ uid: string; name: string }>).map((k) => [k.uid, k.name])
    );

    const completionRows = db.prepare(`
      SELECT taskId, dateString, COUNT(*) as completionCount
      FROM completions
      WHERE dateString = ?
        AND taskId IN (${dueTasks.map(() => '?').join(',')})
      GROUP BY taskId, dateString
    `).all(today, ...dueTasks.map((t) => t.id)) as Array<{ taskId: string; dateString: string; completionCount: number }>;
    const completionCountByTaskDate = new Map<string, number>(
      completionRows.map((r) => [`${r.taskId}:${r.dateString}`, Number(r.completionCount) || 0])
    );
    const createdNotifIds = new Set<string>();
    const parentIdsWithNewNotifications = new Set<string>();

    for (const task of dueTasks) {
      let scheduledForToday = false;
      if (task.frequency === 'daily' || task.frequency === 'twice-daily') {
        scheduledForToday = true;
      } else if (task.frequency === 'weekdays') {
        const day = now.getDay();
        scheduledForToday = day >= 1 && day <= 5;
      } else {
        const createdDate = new Date(task.createdAt);
        const daysSinceCreated = differenceInDays(startOfDay(now), startOfDay(createdDate));
        if (task.frequency === 'weekly') scheduledForToday = daysSinceCreated % 7 === 0;
        else if (task.frequency === 'bi-weekly') scheduledForToday = daysSinceCreated % 14 === 0;
        else if (task.frequency === 'custom' && task.customInterval) scheduledForToday = daysSinceCreated % task.customInterval === 0;
      }

      if (!scheduledForToday) continue;

      const reminderDate = parse(task.reminderTime, 'HH:mm', now);
      if (isAfter(now, reminderDate)) {
        const taskCompletionCount = completionCountByTaskDate.get(`${task.id}:${today}`) || 0;
        const isCompleted = task.frequency === 'twice-daily' ? taskCompletionCount >= 2 : taskCompletionCount >= 1;
        if (!isCompleted) {
          let isLocked = false;
          if (task.prerequisiteTaskIds) {
            try {
              const prereqIds = JSON.parse(task.prerequisiteTaskIds);
              for (const pid of prereqIds) {
                const pTask = taskIdToTask.get(pid);
                if (pTask) {
                  const reqCount = pTask.frequency === 'twice-daily' ? 2 : 1;
                  const prereqCompletionCount = completionCountByTaskDate.get(`${pid}:${today}`) || 0;
                  if (prereqCompletionCount < reqCount) { isLocked = true; break; }
                }
              }
            } catch (e) {}
          }
          if (isLocked) continue;

          const notifId = `overdue_${task.id}_${today}`;
          if (createdNotifIds.has(notifId)) continue;
          const kidName = kidNameById.get(task.assignedKidId) || 'Cadet';
          const result = db.prepare(`INSERT OR IGNORE INTO notifications (id, parentId, kidId, taskId, taskTitle, kidName, type, status, createdAt, dateString) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(notifId, task.parentId, task.assignedKidId, task.id, task.title, kidName, 'overdue', 'unread', Date.now(), today);
          if (result.changes > 0) {
            createdNotifIds.add(notifId);
            parentIdsWithNewNotifications.add(task.parentId);
          }
        }
      }
    }
    for (const parentId of parentIdsWithNewNotifications) {
      io?.to(parentId).emit('stale-data', { type: 'notifications' });
    }
    markWorkerJobSuccess('overdueTasks', startedAt);
  } catch (error) {
    markWorkerJobFailure('overdueTasks', startedAt, error);
    logger.error({ error }, 'worker_overdue_tasks_error');
    throw error;
  }
}

export async function runDailyCleanup() {
  const startedAt = markWorkerJobStart('dailyCleanup');
  try {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const r1 = db.prepare('DELETE FROM sent_reminders WHERE sentAt < ?').run(sevenDaysAgo);
    const r2 = db.prepare("DELETE FROM notifications WHERE status = 'read' AND createdAt < ?").run(thirtyDaysAgo);
    if (r1.changes > 0 || r2.changes > 0) {
      logger.info({ sentRemindersRemoved: r1.changes, notificationsRemoved: r2.changes }, 'worker_daily_cleanup_removed_rows');
    }
    markWorkerJobSuccess('dailyCleanup', startedAt);
  } catch (e) {
    markWorkerJobFailure('dailyCleanup', startedAt, e);
    logger.error({ error: e }, 'worker_daily_cleanup_error');
    throw e;
  }
}

export async function runMidnightEngagementReset() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Reset streaks for kids who missed yesterday
    db.prepare(`
      UPDATE users
      SET currentStreak = 0
      WHERE role = 'kid'
        AND currentStreak > 0
        AND (lastMissionDate IS NULL OR lastMissionDate < ?)
    `).run(yesterdayStr);

    // Select Power Mission for each family (parent)
    const parents = db.prepare("SELECT uid FROM users WHERE role = 'parent'").all() as { uid: string }[];
    for (const parent of parents) {
      const task = db.prepare(`
        SELECT t.id FROM tasks t
        WHERE t.parentId = ?
          AND t.status = 'active'
          AND t.assignedKidId IS NOT NULL
          AND t.assignedKidId != 'all'
        ORDER BY COALESCE(t.starValue, 1) DESC, t.createdAt ASC
        LIMIT 1
      `).get(parent.uid) as { id: string } | undefined;
      db.prepare('UPDATE users SET powerMissionId = ?, powerMissionDate = ? WHERE uid = ?')
        .run(task?.id ?? null, today, parent.uid);
    }

    logger.info({}, 'midnight_engagement_reset_complete');
  } catch (err: any) {
    logger.error({ error: err.message }, 'midnight_engagement_reset_error');
    throw err;
  }
}
