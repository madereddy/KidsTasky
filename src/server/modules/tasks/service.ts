import { db } from '../../db.js';
import { randomUUID } from 'crypto';

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
  
  createCompletion: (data: any) => {
    const id = `${data.taskId}_${data.dateString}_${data.count || 1}`;
    const task = db.prepare('SELECT starValue, requiresApproval FROM tasks WHERE id = ?').get(data.taskId) as { starValue: number; requiresApproval: number } | undefined;
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
    // Award stars immediately if approval not required
    if (result.changes > 0 && !needsApproval) {
      const stars = task?.starValue ?? 1;
      db.prepare('UPDATE users SET earnedStars = earnedStars + ? WHERE uid = ?').run(stars, data.kidId);
    }
    return { id, approvalStatus };
  },

  skipTask: (data: { taskId: string; kidId: string; dateString: string; count?: number }) => {
    const id = `${data.taskId}_${data.dateString}_${data.count || 1}`;
    db.prepare(`
      INSERT INTO completions (id, taskId, kidId, completedAt, dateString, count, approvalStatus)
      VALUES (?, ?, ?, ?, ?, ?, 'skipped')
      ON CONFLICT(id) DO UPDATE SET approvalStatus = 'skipped', completedAt = excluded.completedAt
    `).run(id, data.taskId, data.kidId, Date.now(), data.dateString, data.count || null);
    return { id };
  },

  deleteCompletion: (completionId: string) => {
    const completion = db.prepare("SELECT * FROM completions WHERE id = ?").get(completionId) as any;
    if (completion) {
      // Only revoke stars that were actually awarded (approved completions)
      if (!completion.approvalStatus || completion.approvalStatus === 'approved') {
        const task = db.prepare('SELECT starValue FROM tasks WHERE id = ?').get(completion.taskId) as { starValue: number } | undefined;
        const stars = task?.starValue ?? 1;
        db.prepare('UPDATE users SET earnedStars = MAX(0, earnedStars - ?) WHERE uid = ?').run(stars, completion.kidId);
      }
    }
    db.prepare("DELETE FROM completions WHERE id = ?").run(completionId);
  },

  approveCompletion: (completionId: string) => {
    const completion = db.prepare("SELECT * FROM completions WHERE id = ? AND approvalStatus = 'pending'").get(completionId) as any;
    if (!completion) throw new Error('Completion not found or not pending');
    db.prepare("UPDATE completions SET approvalStatus = 'approved' WHERE id = ?").run(completionId);
    const task = db.prepare('SELECT starValue FROM tasks WHERE id = ?').get(completion.taskId) as { starValue: number } | undefined;
    const stars = task?.starValue ?? 1;
    db.prepare('UPDATE users SET earnedStars = earnedStars + ? WHERE uid = ?').run(stars, completion.kidId);
  },

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
