import fs from 'fs';
import path from 'path';
import { db, dbPath } from '../db.js';
import { logger } from '../lib/logger.js';
import { markWorkerJobStart, markWorkerJobSuccess, markWorkerJobFailure } from './diagnostics.js';

const MAX_BACKUPS = 7;

export async function runDailyBackup() {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;

  const isMemory = dbPath === ':memory:';
  if (isMemory) return;

  const startedAt = markWorkerJobStart('dailyBackup');
  try {
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 10);
    const dest = path.join(backupDir, `database-${stamp}.db`);

    await db.backup(dest);

    // Prune: keep only MAX_BACKUPS most recent
    const files = fs
      .readdirSync(backupDir)
      .filter(f => f.startsWith('database-') && f.endsWith('.db'))
      .sort();
    for (const old of files.slice(0, -MAX_BACKUPS)) {
      fs.unlinkSync(path.join(backupDir, old));
    }

    markWorkerJobSuccess('dailyBackup', startedAt);
    logger.info({ dest, kept: Math.min(files.length, MAX_BACKUPS) }, 'db_backup_complete');
  } catch (err) {
    markWorkerJobFailure('dailyBackup', startedAt, err instanceof Error ? err.message : String(err));
    logger.error({ err }, 'db_backup_failed');
  }
}
