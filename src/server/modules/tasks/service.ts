import { db } from '../../db.js';
import { randomUUID } from 'crypto';
import { levelForXp } from '../../../lib/xp.js';
import { calculateStreakUpdate, getXpMultiplier, evaluateBadges, writeXpEvent } from './streakService.js';

// XP per difficulty — server-authoritative, mirrors client XP_REWARDS in constants.ts.
const XP_BY_DIFFICULTY: Record<string, number> = { easy: 10, medium: 25, hard: 50 };
const xpForDifficulty = (difficulty?: string | null): number =>
  XP_BY_DIFFICULTY[String(difficulty || 'easy')] ?? XP_BY_DIFFICULTY.easy;

// Apply an XP delta to a user and recompute level on the RuneScape-style curve.
function adjustUserXp(kidId: string, delta: number) {
  const row = db.prepare('SELECT xp FROM users WHERE uid = ?').get(kidId) as { xp: number | null } | undefined;
  if (!row) return;
  const newXp = Math.max(0, (row.xp || 0) + delta);
  const newLevel = levelForXp(newXp);
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE uid = ?').run(newXp, newLevel, kidId);
}

export const taskServiceServer = {
  createTask: (task: any) => {
    const id = "task_" + randomUUID();
    const prereqs = task.prerequisiteTaskIds ? JSON.stringify(task.prerequisiteTaskIds) : "[]";
    const requiresApproval = task.requiresApproval === undefined ? 1 : (task.requiresApproval ? 1 : 0);
    const completionQuestions = Array.isArray(task.completionQuestions) && task.completionQuestions.length > 0
      ? JSON.stringify(task.completionQuestions)
      : null;
    const completionQuestionsKidId = task.completionQuestionsKidId || null;
    db.prepare(`
      INSERT INTO tasks (
        id, title, description, frequency, reminderTime, assignedKidId, parentId, categoryId, difficulty, status,
        createdAt, customInterval, prerequisiteTaskIds, starValue, requiresApproval, completionQuestions, completionQuestionsKidId
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, task.title, task.description || null, task.frequency, task.reminderTime || null, task.assignedKidId, task.parentId,
      task.categoryId || null, task.difficulty || 'easy', 'active', Date.now(), task.customInterval || null, prereqs,
      task.starValue ?? 1, requiresApproval, completionQuestions, completionQuestionsKidId
    );
    if (task.assignedKidId) {
      writeXpEvent(task.parentId, task.parentId, 5, 'task_assigned');
    }
    return id;
  },
  
  getKidsTasks: (kidId: string) => {
    return db.prepare("SELECT * FROM tasks WHERE (assignedKidId = ? OR assignedKidId = 'all') AND status = 'active' ORDER BY createdAt DESC").all(kidId);
  },
  
  getParentsTasks: (parentId: string) => {
    return db.prepare("SELECT * FROM tasks WHERE parentId = ? AND status = 'active' ORDER BY createdAt DESC").all(parentId);
  },

  getTaskById: (taskId: string) => {
    return db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as { parentId: string; assignedKidId: string; starValue: number; requiresApproval: number } | undefined;
  },

  getCompletionById: (completionId: string) => {
    return db.prepare("SELECT * FROM completions WHERE id = ?").get(completionId) as { taskId: string; kidId: string } | undefined;
  },

  archiveTask: (taskId: string) => {
    db.prepare("UPDATE tasks SET status = 'archived' WHERE id = ?").run(taskId);
  },

  updateTask: (taskId: string, parentId: string, fields: any) => {
    const allowed = [
      'title',
      'description',
      'frequency',
      'reminderTime',
      'assignedKidId',
      'categoryId',
      'difficulty',
      'customInterval',
      'prerequisiteTaskIds',
      'starValue',
      'requiresApproval',
      'completionQuestions',
      'completionQuestionsKidId',
    ];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (!(key in fields)) continue;
      sets.push(`${key} = ?`);
      if (key === 'prerequisiteTaskIds') {
        const prereqs = Array.isArray(fields[key]) ? JSON.stringify(fields[key]) : '[]';
        values.push(prereqs);
      } else if (key === 'completionQuestions') {
        const questions = Array.isArray(fields[key]) && fields[key].length > 0 ? JSON.stringify(fields[key]) : null;
        values.push(questions);
      } else if (key === 'requiresApproval') {
        values.push(fields[key] ? 1 : 0);
      } else {
        values.push(fields[key] ?? null);
      }
    }
    if (sets.length === 0) return false;
    values.push(taskId, parentId);
    const result = db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND parentId = ?`).run(...values);
    return result.changes > 0;
  },
  
  createCompletion: db.transaction((data: any) => {
    const id = `${data.taskId}_${data.dateString}_${data.count || 1}`;
    const task = db.prepare('SELECT id, parentId, starValue, requiresApproval, difficulty FROM tasks WHERE id = ?').get(data.taskId) as { id: string; parentId: string; starValue: number; requiresApproval: number; difficulty: string } | undefined;
    const needsApproval = Boolean(task?.requiresApproval);
    const approvalStatus = needsApproval ? 'pending' : 'approved';
    const proofAnswers = Array.isArray(data.proofAnswers) && data.proofAnswers.length > 0
      ? JSON.stringify(data.proofAnswers)
      : null;
    const result = db.prepare(`
      INSERT INTO completions (id, taskId, kidId, completedAt, dateString, count, approvalStatus, proofAnswers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(id, data.taskId, data.kidId, Date.now(), data.dateString, data.count || null, approvalStatus, proofAnswers);

    let streakDay = 0;
    let badgesEarned: string[] = [];
    let xpEarned = 0;

    // Award stars + XP immediately if approval not required (otherwise granted on approval)
    if (result.changes > 0 && !needsApproval) {
      const stars = task?.starValue ?? 1;
      db.prepare('UPDATE users SET earnedStars = earnedStars + ? WHERE uid = ?').run(stars, data.kidId);
      const baseXp = xpForDifficulty(task?.difficulty);

      // Streak update
      const today = new Date().toISOString().slice(0, 10);
      const kidUser = db.prepare('SELECT currentStreak, longestStreak, lastMissionDate, badges FROM users WHERE uid = ?').get(data.kidId) as { currentStreak: number; longestStreak: number; lastMissionDate: string | null; badges: string } | undefined;
      const { newStreak, newLongest } = calculateStreakUpdate(kidUser?.lastMissionDate ?? null, today, kidUser?.currentStreak ?? 0, kidUser?.longestStreak ?? 0);
      db.prepare('UPDATE users SET currentStreak = ?, longestStreak = ?, lastMissionDate = ? WHERE uid = ?')
        .run(newStreak, newLongest, today, data.kidId);

      // XP with streak multiplier
      const multiplier = getXpMultiplier(newStreak);
      xpEarned = Math.round(baseXp * multiplier);
      adjustUserXp(data.kidId, xpEarned);
      writeXpEvent(data.kidId, task?.parentId ?? '', xpEarned, 'mission_completion');

      // Badge evaluation
      const completionCount = (db.prepare('SELECT COUNT(*) AS c FROM completions WHERE kidId = ? AND approvalStatus != ?').get(data.kidId, 'skipped') as { c: number }).c;
      const powerMissionCount = (db.prepare("SELECT COUNT(*) AS c FROM xp_events WHERE userId = ? AND reason = 'power_mission'").get(data.kidId) as { c: number }).c;
      const existingBadges: string[] = JSON.parse(kidUser?.badges ?? '[]');
      const allEarned = evaluateBadges({ streak: newStreak, completions: completionCount, powerMissions: powerMissionCount, isFamilyMvp: false });
      badgesEarned = allEarned.filter(b => !existingBadges.includes(b));
      if (badgesEarned.length > 0) {
        db.prepare('UPDATE users SET badges = ? WHERE uid = ?').run(JSON.stringify([...existingBadges, ...badgesEarned]), data.kidId);
      }
      streakDay = newStreak;
    }

    return { id, approvalStatus, created: result.changes > 0, streakDay, badgesEarned, xpEarned, taskId: task?.id };
  }),

  skipTask: (data: { taskId: string; kidId: string; dateString: string; count?: number }) => {
    const id = `${data.taskId}_${data.dateString}_${data.count || 1}`;
    db.prepare(`
      INSERT INTO completions (id, taskId, kidId, completedAt, dateString, count, approvalStatus)
      VALUES (?, ?, ?, ?, ?, ?, 'skipped')
      ON CONFLICT(id) DO UPDATE SET approvalStatus = 'skipped', completedAt = excluded.completedAt
    `).run(id, data.taskId, data.kidId, Date.now(), data.dateString, data.count || null);
    return { id };
  },

  deleteCompletion: db.transaction((completionId: string) => {
    const completion = db.prepare("SELECT * FROM completions WHERE id = ?").get(completionId) as any;
    if (completion) {
      // Only revoke stars + XP that were actually awarded (approved completions)
      if (!completion.approvalStatus || completion.approvalStatus === 'approved') {
        const task = db.prepare('SELECT starValue, difficulty FROM tasks WHERE id = ?').get(completion.taskId) as { starValue: number; difficulty: string } | undefined;
        const stars = task?.starValue ?? 1;
        db.prepare('UPDATE users SET earnedStars = MAX(0, earnedStars - ?) WHERE uid = ?').run(stars, completion.kidId);
        adjustUserXp(completion.kidId, -xpForDifficulty(task?.difficulty));
      }
    }
    db.prepare("DELETE FROM completions WHERE id = ?").run(completionId);
  }),

  approveCompletion: db.transaction((completionId: string) => {
    const completion = db.prepare("SELECT * FROM completions WHERE id = ? AND approvalStatus = 'pending'").get(completionId) as any;
    if (!completion) throw new Error('Completion not found or not pending');
    db.prepare("UPDATE completions SET approvalStatus = 'approved' WHERE id = ?").run(completionId);
    const task = db.prepare('SELECT parentId, starValue, difficulty FROM tasks WHERE id = ?').get(completion.taskId) as { parentId: string; starValue: number; difficulty: string } | undefined;
    const stars = task?.starValue ?? 1;
    db.prepare('UPDATE users SET earnedStars = earnedStars + ? WHERE uid = ?').run(stars, completion.kidId);
    adjustUserXp(completion.kidId, xpForDifficulty(task?.difficulty));
    if (task?.parentId) {
      writeXpEvent(task.parentId, task.parentId, 10, 'task_approved');
    }
  }),

  rejectCompletion: (completionId: string) => {
    db.prepare("UPDATE completions SET approvalStatus = 'rejected' WHERE id = ?").run(completionId);
  },

  getPendingCompletionsByParent: (parentId: string) => {
    return db.prepare(`
      SELECT c.*, t.title as taskTitle, t.parentId, u.name as kidName
      FROM completions c
      JOIN tasks t ON c.taskId = t.id
      JOIN users u ON c.kidId = u.uid
      WHERE t.parentId = ? AND c.approvalStatus = 'pending'
      ORDER BY c.completedAt DESC
    `).all(parentId);
  },
  
  getCompletionsByDateRange: (kidId: string, startDate: string, endDate: string) => {
    return db.prepare("SELECT * FROM completions WHERE kidId = ? AND dateString >= ? AND dateString <= ?").all(kidId, startDate, endDate);
  },
  
  getCompletionsByDate: (kidId: string, dateString: string) => {
    return db.prepare("SELECT * FROM completions WHERE kidId = ? AND dateString = ?").all(kidId, dateString);
  },
  
  getCompletionHistory: (kidId: string, limit: number) => {
    return db.prepare("SELECT * FROM completions WHERE kidId = ? ORDER BY completedAt DESC LIMIT ?").all(kidId, limit);
  }
};
