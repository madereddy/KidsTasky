import { format, parse, isAfter, startOfDay, differenceInDays } from "date-fns";
import { db } from "./db.js";
import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import type { Server as SocketServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import ical from 'node-ical';
import { magicService } from './modules/magic/service.js';
import { syncService } from './modules/sync/service.js';
import { sendPushToUser } from './modules/notifications/pushService.js';
import { sendEmail } from './modules/notifications/emailService.js';
import { ensurePhotosUploadsDir } from './modules/photos/storage.js';


const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const intervalHandles: ReturnType<typeof setInterval>[] = [];
const cronHandles: ScheduledTask[] = [];

const syncBackoff = { failCount: 0, nextAllowedAt: 0 };
const workerStartedAt = Date.now();
let workerActive = false;

type WorkerJobDiagnostics = {
  name: string;
  intervalType: 'interval' | 'cron';
  schedule: string;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastDurationMs: number | null;
  successCount: number;
  failureCount: number;
  lastError: string | null;
};

const workerJobs: Record<string, WorkerJobDiagnostics> = {
  eventReminders: {
    name: 'eventReminders',
    intervalType: 'interval',
    schedule: '60000ms',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  overdueTasks: {
    name: 'overdueTasks',
    intervalType: 'interval',
    schedule: '300000ms',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  photoCleanup: {
    name: 'photoCleanup',
    intervalType: 'interval',
    schedule: '900000ms',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  dailyCleanup: {
    name: 'dailyCleanup',
    intervalType: 'cron',
    schedule: '0 3 * * *',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
  multiSourceSync: {
    name: 'multiSourceSync',
    intervalType: 'cron',
    schedule: '*/5 * * * *',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    successCount: 0,
    failureCount: 0,
    lastError: null,
  },
};

function markWorkerJobStart(jobName: keyof typeof workerJobs): number {
  const startedAt = Date.now();
  const job = workerJobs[jobName];
  job.lastStartedAt = startedAt;
  return startedAt;
}

function markWorkerJobSuccess(jobName: keyof typeof workerJobs, startedAt: number) {
  const job = workerJobs[jobName];
  const finishedAt = Date.now();
  job.lastFinishedAt = finishedAt;
  job.lastSuccessAt = finishedAt;
  job.lastDurationMs = finishedAt - startedAt;
  job.successCount += 1;
  job.lastError = null;
}

function markWorkerJobFailure(jobName: keyof typeof workerJobs, startedAt: number, error: unknown) {
  const job = workerJobs[jobName];
  const finishedAt = Date.now();
  job.lastFinishedAt = finishedAt;
  job.lastFailureAt = finishedAt;
  job.lastDurationMs = finishedAt - startedAt;
  job.failureCount += 1;
  job.lastError = error instanceof Error ? error.message : String(error);
}

function shouldSkipGoogleSync(): boolean {
  return Date.now() < syncBackoff.nextAllowedAt;
}

function onGoogleSyncSuccess() {
  syncBackoff.failCount = 0;
  syncBackoff.nextAllowedAt = 0;
}

function onGoogleSyncFailure(err: any) {
  const is429 = err?.status === 429 || err?.code === 429 ||
    String(err?.message).toLowerCase().includes('quota') ||
    String(err?.message).toLowerCase().includes('rate limit');
  if (is429) {
    syncBackoff.failCount++;
    // Exponential backoff: 1min, 2min, 4min, 8min, 16min — max 30min
    const delayMs = Math.min(Math.pow(2, syncBackoff.failCount) * 60_000, 30 * 60_000);
    syncBackoff.nextAllowedAt = Date.now() + delayMs;
    console.warn(`[worker] Google sync rate-limited (429). Backoff: ${delayMs / 60_000}min (fail #${syncBackoff.failCount})`);
  }
}

export function startBackgroundWorker(io?: SocketServer) {
  workerActive = true;
  const lastPhotoCleanupRun = new Map<string, number>();
  let photoSweepUploadsDirUnavailable = false;
  const REMINDER_WINDOW_MS = 60_000;
  const MAX_NOTIFICATION_CONCURRENCY = 4;

  async function runWithConcurrency<T>(
    items: T[],
    workerFn: (item: T) => Promise<void>,
    concurrency = MAX_NOTIFICATION_CONCURRENCY
  ) {
    const queue = [...items];
    const runners = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) return;
        try {
          await workerFn(item);
        } catch (e) {
          console.error('[worker] async worker item failed:', e);
        }
      }
    });
    await Promise.all(runners);
  }

  intervalHandles.push(setInterval(async () => {
    const startedAt = markWorkerJobStart('eventReminders');
    try {
      await sendEventReminders();
      markWorkerJobSuccess('eventReminders', startedAt);
    } catch (e) {
      markWorkerJobFailure('eventReminders', startedAt, e);
      console.error('[worker] reminder error:', e);
    }
  }, REMINDER_WINDOW_MS));

  async function sendEventReminders() {
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
  }

  intervalHandles.push(setInterval(() => {
    const startedAt = markWorkerJobStart('overdueTasks');
    console.log("[Worker] Checking for overdue tasks...");
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
      console.error("[Worker Error]", error);
    }
  }, 5 * 60 * 1000));

  intervalHandles.push(setInterval(() => {
    const startedAt = markWorkerJobStart('photoCleanup');
    try {
      const families = db.prepare(`
        SELECT parentId, photoCleanupEnabled, photoCleanupIntervalHours
        FROM family_settings
      `).all() as Array<{ parentId: string; photoCleanupEnabled?: number; photoCleanupIntervalHours?: number }>;

      const now = Date.now();
      let shouldRunGlobalOrphanSweep = false;
      for (const family of families) {
        if (!family.parentId || Number(family.photoCleanupEnabled ?? 1) !== 1) continue;
        const intervalHours = Math.max(1, Number(family.photoCleanupIntervalHours || 24));
        const intervalMs = intervalHours * 60 * 60 * 1000;
        const lastRun = lastPhotoCleanupRun.get(family.parentId) ?? 0;
        if (now - lastRun < intervalMs) continue;

        const photos = db.prepare('SELECT id, url FROM family_photos WHERE parentId = ?')
          .all(family.parentId) as Array<{ id: string; url: string }>;

        const parentExists = db.prepare('SELECT 1 FROM users WHERE uid = ?').get(family.parentId);
        for (const photo of photos) {
          const url = photo.url;
          // Extract filename for local photos only; skip remote URLs (Google Photos https*)
          let localFilename: string | null = null;
          if (url.startsWith('/api/photos/file/')) {
            localFilename = path.basename(url.replace('/api/photos/file/', ''));
          } else if (url.startsWith('/uploads/photos/')) {
            localFilename = path.basename(url.replace('/uploads/photos/', ''));
          }

          if (!parentExists) {
            db.prepare('DELETE FROM family_photos WHERE id = ?').run(photo.id);
            if (localFilename) {
              const filePath = path.join(ensurePhotosUploadsDir(), localFilename);
              fs.unlink(filePath, () => {});
            }
            continue;
          }

          // Only check file existence for local photos; remote URLs are always "present"
          if (localFilename) {
            const filePath = path.join(ensurePhotosUploadsDir(), localFilename);
            if (!fs.existsSync(filePath)) {
              db.prepare('DELETE FROM family_photos WHERE id = ?').run(photo.id);
            }
          }
        }
        shouldRunGlobalOrphanSweep = true;
        lastPhotoCleanupRun.set(family.parentId, now);
      }

      if (shouldRunGlobalOrphanSweep) {
        if (photoSweepUploadsDirUnavailable) {
          markWorkerJobSuccess('photoCleanup', startedAt);
          return;
        }
        let uploadsDir: string;
        try {
          uploadsDir = ensurePhotosUploadsDir();
        } catch (err) {
          photoSweepUploadsDirUnavailable = true;
          console.error('[worker] uploads dir unavailable for photo sweep; disabling orphan file sweep:', err);
          return;
        }
        const trackedFiles = new Set(
          (db.prepare("SELECT url FROM family_photos WHERE url LIKE '/uploads/photos/%' OR url LIKE '/api/photos/file/%'")
            .all() as Array<{ url: string }>)
            .map((r) => path.basename(r.url))
        );
        for (const file of fs.readdirSync(uploadsDir)) {
          if (!trackedFiles.has(file)) {
            fs.unlink(path.join(uploadsDir, file), () => {});
          }
        }
      }
      markWorkerJobSuccess('photoCleanup', startedAt);
    } catch (error) {
      markWorkerJobFailure('photoCleanup', startedAt, error);
      console.error('[worker] photo cleanup error:', error);
    }
  }, 15 * 60 * 1000));

  // Daily cleanup: prune unbounded tables that accumulate over time
  cronHandles.push(cron.schedule("0 3 * * *", () => {
    const startedAt = markWorkerJobStart('dailyCleanup');
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const r1 = db.prepare('DELETE FROM sent_reminders WHERE sentAt < ?').run(sevenDaysAgo);
      const r2 = db.prepare("DELETE FROM notifications WHERE status = 'read' AND createdAt < ?").run(thirtyDaysAgo);
      if (r1.changes > 0 || r2.changes > 0) {
        console.log(`[worker] daily cleanup: removed ${r1.changes} sent_reminders, ${r2.changes} old notifications`);
      }
      markWorkerJobSuccess('dailyCleanup', startedAt);
    } catch (e) {
      markWorkerJobFailure('dailyCleanup', startedAt, e);
      console.error('[worker] daily cleanup error:', e);
    }
  }));

  cronHandles.push(cron.schedule("*/5 * * * *", async () => {
    const startedAt = markWorkerJobStart('multiSourceSync');
    try {
    console.log("[Worker] Start Multi-Source Sync...");
    
    if (shouldSkipGoogleSync()) {
      console.log(`[worker] Google sync skipped — in backoff until ${new Date(syncBackoff.nextAllowedAt).toISOString()}`);
    } else {
      try {
        const connections = db.prepare("SELECT * FROM sync_connections WHERE provider = 'google' AND refreshToken IS NOT NULL").all() as any[];
        let anyRateLimit = false;
        for (const conn of connections) {
          try {
            const result = await syncService.syncGoogleConnectionNow(conn);
            if (result.errors.some(e => e.message.includes('invalid_grant'))) {
              console.error('[worker:invalid_grant]', { connectionId: conn.id });
              db.prepare('DELETE FROM sync_connections WHERE id = ?').run(conn.id);
            } else if (result.imported > 0) {
              io?.to(conn.parentId).emit('stale-data', { type: 'events' });
            }
            if (result.failureCount > 0) {
              console.error('[worker:sync_partial]', { connectionId: conn.id, errors: result.errors });
            }
          } catch (err: any) {
            console.error('[worker:sync_connection_error]', { connectionId: conn.id, error: err?.message });
            onGoogleSyncFailure(err);
            anyRateLimit = true;
          }
        }
        if (!anyRateLimit) onGoogleSyncSuccess();
      } catch (err: any) {
        console.error('[worker:sync_global_error]', err);
        onGoogleSyncFailure(err);
      }
    }

    try {
      const icalConns = db.prepare("SELECT * FROM sync_connections WHERE icalUrl IS NOT NULL").all() as any[];
      for (const conn of icalConns) {
        if (!conn.icalUrl) continue;
        const webEvents = await ical.fromURL(conn.icalUrl);
        const existingExternalIds = new Set(
          (db.prepare("SELECT externalId FROM events WHERE parentId = ? AND source = 'ical' AND externalId IS NOT NULL")
            .all(conn.parentId) as Array<{ externalId: string }>)
            .map((row) => row.externalId)
        );
        let changes = false;
        for (const k in webEvents) {
          const ev: any = webEvents[k];
          if (!ev || ev.type !== 'VEVENT' || !ev.summary || !ev.start || !ev.end) continue;
          const eId = "ical_" + (ev.uid || k);
          if (!existingExternalIds.has(eId)) {
            db.prepare(`INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(eId, conn.parentId, ev.summary, ev.description || '', new Date(ev.start).getTime(), new Date(ev.end).getTime(), null, 'purple', eId, 'ical');
            existingExternalIds.add(eId);
            changes = true;
          }
        }
        if (changes) io?.to(conn.parentId).emit('stale-data', { type: 'events' });
      }
    } catch (err) { console.error("[Worker] iCal Sync Error", err); }

    if (GEMINI_API_KEY) {
      try {
        const manualConns = syncService.getManualConnections();
        for (const conn of manualConns) {
          let connection;
          try {
            const config = { imap: { user: conn.email, password: conn.appPassword, host: 'imap.gmail.com', port: 993, tls: true, authTimeout: 3000 } };
            connection = await imaps.connect(config);
            await connection.openBox('INBOX');
            const messages = await connection.search(['UNSEEN'], { bodies: ['HEADER', 'TEXT'], markSeen: true });
            for (const msg of messages) {
              const all = msg.parts.find((p: any) => p.which === 'TEXT');
              if (all) {
                const parsed = await simpleParser(all.body);
                const extracted = await magicService.parseEventsFromText(parsed.text || parsed.html || '', GEMINI_API_KEY);
                if (extracted && extracted.title && extracted.date) {
                  const startTs = new Date(`${extracted.date}T${extracted.startTime || '09:00'}:00`).getTime();
                  db.prepare(`INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("magic_" + Date.now() + "_" + msg.attributes.uid, conn.parentId, extracted.title, `From email: ${extracted.location || ''}`, startTs, startTs + 3600000, null, 'amber', 'magic');
                  io?.to(conn.parentId).emit('stale-data', { type: 'events' });
                }
              }
            }
          } catch (connErr) {
            console.error('[Worker] IMAP error for', conn.email, ':', connErr);
          } finally {
            try { connection?.end(); } catch {}
          }
        }
      } catch (err) { console.error("[Worker] IMAP Sync Error", err); }
    }
      markWorkerJobSuccess('multiSourceSync', startedAt);
    } catch (error) {
      markWorkerJobFailure('multiSourceSync', startedAt, error);
      console.error('[worker] multi-source sync error:', error);
    }
  }));
}

export function stopWorker() {
  workerActive = false;
  intervalHandles.forEach(h => clearInterval(h));
  cronHandles.forEach(h => h.stop());
  intervalHandles.length = 0;
  cronHandles.length = 0;
}

export function getWorkerDiagnostics() {
  return {
    active: workerActive,
    startedAt: workerStartedAt,
    googleSyncBackoff: {
      failCount: syncBackoff.failCount,
      nextAllowedAt: syncBackoff.nextAllowedAt,
      nextAllowedInMs: Math.max(0, syncBackoff.nextAllowedAt - Date.now()),
    },
    jobs: workerJobs,
  };
}
