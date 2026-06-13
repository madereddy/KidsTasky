import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import type { Server as SocketServer } from 'socket.io';
import { logger } from './lib/logger.js';
import { syncBackoff } from './lib/syncBackoff.js';
import { workerJobs } from './worker/diagnostics.js';
import { sendEventReminders, REMINDER_WINDOW_MS } from './worker/reminders.js';
import { processOverdueTasks, runDailyCleanup, runMidnightEngagementReset } from './worker/tasks.js';
import { runPhotoCleanup } from './worker/photos.js';
import { runMultiSourceSync } from './worker/sync.js';

const intervalHandles: ReturnType<typeof setInterval>[] = [];
const cronHandles: ScheduledTask[] = [];

const workerStartedAt = Date.now();
let workerActive = false;

export function startBackgroundWorker(io?: SocketServer) {
  workerActive = true;

  // 1. Event Reminders (every 1 minute)
  intervalHandles.push(setInterval(async () => {
    try {
      await sendEventReminders();
    } catch (e) {
      // Error already logged and diagnostics updated in module
    }
  }, REMINDER_WINDOW_MS));

  // 2. Overdue Tasks (every 5 minutes)
  intervalHandles.push(setInterval(async () => {
    try {
      await processOverdueTasks(io);
    } catch (e) {
      // Error already logged and diagnostics updated in module
    }
  }, 5 * 60 * 1000));

  // 3. Photo Cleanup (every 15 minutes)
  intervalHandles.push(setInterval(async () => {
    try {
      await runPhotoCleanup();
    } catch (e) {
      // Error already logged and diagnostics updated in module
    }
  }, 15 * 60 * 1000));

  // 4. Daily Cleanup (3:00 AM)
  cronHandles.push(cron.schedule("0 3 * * *", async () => {
    try {
      await runDailyCleanup();
    } catch (e) {
      // Error already logged and diagnostics updated in module
    }
  }));

  // 5. Multi-Source Sync (every 5 minutes)
  cronHandles.push(cron.schedule("*/5 * * * *", async () => {
    try {
      await runMultiSourceSync(io);
    } catch (e) {
      // Error already logged and diagnostics updated in module
    }
  }));

  // 6. Midnight Reset (0:01 AM)
  cronHandles.push(cron.schedule('1 0 * * *', async () => {
    try {
      await runMidnightEngagementReset();
    } catch (err: any) {
      // Error already logged in module
    }
  }));

  logger.info({ workerJobs: Object.keys(workerJobs) }, 'background_worker_started');
}

export function stopWorker() {
  workerActive = false;
  intervalHandles.forEach(h => clearInterval(h));
  cronHandles.forEach(h => h.stop());
  intervalHandles.length = 0;
  cronHandles.length = 0;
  logger.info('background_worker_stopped');
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
