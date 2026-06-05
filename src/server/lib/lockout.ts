import { db } from '../db.js';
import { logger } from './logger.js';

interface LockoutState {
  targetId: string;
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number | null;
}

/**
 * Check if a target is currently locked out.
 * Returns { locked: boolean, remainingMs: number }
 */
export function getLockoutState(targetId: string): { locked: boolean; remainingMs: number; failedAttempts: number } {
  const row = db.prepare('SELECT * FROM auth_lockouts WHERE targetId = ?').get(targetId) as LockoutState | undefined;
  
  if (!row) return { locked: false, remainingMs: 0, failedAttempts: 0 };

  const now = Date.now();
  if (row.lockedUntil && row.lockedUntil > now) {
    return { 
      locked: true, 
      remainingMs: row.lockedUntil - now,
      failedAttempts: row.failedAttempts
    };
  }

  return { locked: false, remainingMs: 0, failedAttempts: row.failedAttempts };
}

/**
 * Record a failed attempt and return the new lockout state.
 */
export function recordFailedAttempt(targetId: string): { locked: boolean; remainingMs: number } {
  const now = Date.now();
  const row = db.prepare('SELECT * FROM auth_lockouts WHERE targetId = ?').get(targetId) as LockoutState | undefined;
  
  const failedAttempts = (row?.failedAttempts || 0) + 1;
  let lockedUntil: number | null = null;

  // exponential lockout strategy (Apple-like)
  // 1-5 fails: no delay
  // 6 fails: 1 minute
  // 7 fails: 5 minutes
  // 8 fails: 15 minutes
  // 9 fails: 1 hour
  // 10+ fails: 24 hours
  if (failedAttempts === 6) lockedUntil = now + 60 * 1000;
  else if (failedAttempts === 7) lockedUntil = now + 5 * 60 * 1000;
  else if (failedAttempts === 8) lockedUntil = now + 15 * 60 * 1000;
  else if (failedAttempts === 9) lockedUntil = now + 60 * 60 * 1000;
  else if (failedAttempts >= 10) lockedUntil = now + 24 * 60 * 60 * 1000;

  db.prepare(`
    INSERT INTO auth_lockouts (targetId, failedAttempts, lockedUntil, lastAttemptAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(targetId) DO UPDATE SET
      failedAttempts = excluded.failedAttempts,
      lockedUntil = excluded.lockedUntil,
      lastAttemptAt = excluded.lastAttemptAt
  `).run(targetId, failedAttempts, lockedUntil, now);

  const remainingMs = lockedUntil ? lockedUntil - now : 0;
  
  if (lockedUntil) {
    logger.warn({ targetId, failedAttempts, remainingMs }, 'auth_lockout_triggered');
  }

  return { locked: !!lockedUntil, remainingMs };
}

/**
 * Reset lockout state after successful authentication.
 */
export function resetLockout(targetId: string) {
  db.prepare('DELETE FROM auth_lockouts WHERE targetId = ?').run(targetId);
}
