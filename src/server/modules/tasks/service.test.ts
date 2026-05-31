// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db.js';
import { taskServiceServer } from './service.js';

describe('taskServiceServer transaction safety', () => {
  const parentId = 'tx_test_parent';
  const kid1 = 'tx_test_kid1';
  const kid2 = 'tx_test_kid2';
  const taskId = 'tx_test_task';

  beforeEach(() => {
    db.prepare('DELETE FROM completions WHERE taskId = ?').run(taskId);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    db.prepare('DELETE FROM users WHERE uid IN (?, ?, ?)').run(parentId, kid1, kid2);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, earnedStars) VALUES (?, 'parent', ?, ?, ?, 0)").run(parentId, 'TX Parent', 'tx@test.com', parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, earnedStars) VALUES (?, 'kid', 'Kid1', 'k1@test.com', ?, 0)").run(kid1, parentId);
    db.prepare("INSERT OR IGNORE INTO users (uid, role, name, email, parentId, earnedStars) VALUES (?, 'kid', 'Kid2', 'k2@test.com', ?, 0)").run(kid2, parentId);
    db.prepare("INSERT INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, starValue, requiresApproval) VALUES (?, 'Chore', 'daily', ?, ?, 'active', ?, 3, 0)").run(taskId, kid1, parentId, Date.now());
  });

  it('awards stars exactly once even when createCompletion called twice with same id', () => {
    taskServiceServer.createCompletion({ taskId, kidId: kid1, dateString: '2026-06-01' });
    taskServiceServer.createCompletion({ taskId, kidId: kid1, dateString: '2026-06-01' }); // duplicate
    const kid = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kid1) as any;
    expect(kid.earnedStars).toBe(3); // stars awarded once, not twice
  });

  it('concurrent completion attempts for same task+date are idempotent (no double-award)', async () => {
    // Same task, same date, same count => same completion ID => only one insert
    await Promise.all([
      Promise.resolve(taskServiceServer.createCompletion({ taskId, kidId: kid1, dateString: '2026-06-01' })),
      Promise.resolve(taskServiceServer.createCompletion({ taskId, kidId: kid1, dateString: '2026-06-01' })),
    ]);
    const kid = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kid1) as any;
    // Should be awarded exactly once (3 stars), not twice (6 stars)
    expect(kid.earnedStars).toBe(3);
    const completions = db.prepare('SELECT COUNT(*) as cnt FROM completions WHERE taskId = ?').get(taskId) as any;
    expect(completions.cnt).toBe(1);
  });

  it('approveCompletion awards stars atomically', () => {
    // Create task requiring approval
    const approvalTaskId = 'tx_approval_task';
    db.prepare("INSERT OR REPLACE INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, starValue, requiresApproval) VALUES (?, 'Approval Chore', 'daily', ?, ?, 'active', ?, 5, 1)").run(approvalTaskId, kid1, parentId, Date.now());
    const result = taskServiceServer.createCompletion({ taskId: approvalTaskId, kidId: kid1, dateString: '2026-06-02' });
    expect(result.approvalStatus).toBe('pending');

    // Stars not awarded yet
    const before = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kid1) as any;
    expect(before.earnedStars).toBe(0);

    taskServiceServer.approveCompletion(result.id);
    const after = db.prepare('SELECT earnedStars FROM users WHERE uid = ?').get(kid1) as any;
    expect(after.earnedStars).toBe(5);

    db.prepare('DELETE FROM tasks WHERE id = ?').run(approvalTaskId);
    db.prepare('DELETE FROM completions WHERE taskId = ?').run(approvalTaskId);
  });
});
