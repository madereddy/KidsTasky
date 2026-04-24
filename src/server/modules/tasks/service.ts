import { db } from '../../db.js';

export const taskServiceServer = {
  createTask: (task: any) => {
    const id = "task_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
    const prereqs = task.prerequisiteTaskIds ? JSON.stringify(task.prerequisiteTaskIds) : "[]";
    db.prepare(`
      INSERT INTO tasks (id, title, description, frequency, reminderTime, assignedKidId, parentId, categoryId, difficulty, status, createdAt, customInterval, prerequisiteTaskIds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, task.title, task.description || null, task.frequency, task.reminderTime || null, task.assignedKidId, task.parentId, task.categoryId || null, task.difficulty || 'easy', 'active', Date.now(), task.customInterval || null, prereqs);
    return id;
  },
  
  getKidsTasks: (kidId: string) => {
    return db.prepare("SELECT * FROM tasks WHERE assignedKidId = ? AND status = 'active' ORDER BY createdAt DESC").all(kidId);
  },
  
  getParentsTasks: (parentId: string) => {
    return db.prepare("SELECT * FROM tasks WHERE parentId = ? AND status = 'active' ORDER BY createdAt DESC").all(parentId);
  },
  
  archiveTask: (taskId: string) => {
    db.prepare("UPDATE tasks SET status = 'archived' WHERE id = ?").run(taskId);
  },
  
  createCompletion: (data: any) => {
    const id = `${data.taskId}_${data.dateString}_${data.count || 1}`;
    db.prepare(`
      INSERT OR REPLACE INTO completions (id, taskId, kidId, completedAt, dateString, count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.taskId, data.kidId, Date.now(), data.dateString, data.count || null);
    return id;
  },
  
  deleteCompletion: (completionId: string) => {
    db.prepare("DELETE FROM completions WHERE id = ?").run(completionId);
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
