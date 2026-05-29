import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { Homework } from '../../../types.js';

type HomeworkUpdate = Partial<Pick<Homework, 'title' | 'subject' | 'notes' | 'dueDate' | 'assignedToId' | 'status' | 'color' | 'completionResponse' | 'recurrence'>>;

export const homeworkService = {
  create(data: Omit<Homework, 'id' | 'createdAt'>): string {
    const id = 'hw_' + randomUUID();
    const completionQuestions = Array.isArray(data.completionQuestions) && data.completionQuestions.length > 0
      ? JSON.stringify(data.completionQuestions)
      : null;
    db.prepare(`
      INSERT INTO homework (
        id, parentId, title, subject, notes, dueDate, assignedToId, status, color,
        completionQuestions, completionQuestionsKidId, completionResponse, recurrence
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.parentId, data.title, data.subject, data.notes ?? null, data.dueDate, data.assignedToId ?? null, data.status ?? 'pending', data.color,
      completionQuestions, data.completionQuestionsKidId ?? null, data.completionResponse ?? null, data.recurrence ?? 'none'
    );
    return id;
  },

  getByParent(parentId: string): Homework[] {
    return db.prepare('SELECT * FROM homework WHERE parentId = ? ORDER BY dueDate ASC, createdAt DESC').all(parentId) as Homework[];
  },

  getById(id: string): Homework | undefined {
    return db.prepare('SELECT * FROM homework WHERE id = ?').get(id) as Homework | undefined;
  },

  update(id: string, parentId: string, fields: HomeworkUpdate): boolean {
    const current = db.prepare('SELECT dueDate, recurrence FROM homework WHERE id = ? AND parentId = ?').get(id, parentId) as { dueDate: string; recurrence?: 'none' | 'daily' | 'weekdays' } | undefined;
    if (!current) return false;
    if (fields.status === 'done' && current.recurrence && current.recurrence !== 'none') {
      const parts = String(current.dueDate).split('-').map((v) => Number(v));
      const base = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(current.dueDate);
      if (!Number.isNaN(base.getTime())) {
        const d = new Date(base);
        d.setHours(0, 0, 0, 0);
        if (current.recurrence === 'daily') {
          d.setDate(d.getDate() + 1);
        } else if (current.recurrence === 'weekdays') {
          d.setDate(d.getDate() + 1);
          while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        }
        fields.status = 'pending';
        fields.dueDate = d.toISOString().slice(0, 10);
      }
    }

    const allowed: Array<keyof HomeworkUpdate> = ['title', 'subject', 'notes', 'dueDate', 'assignedToId', 'status', 'color', 'completionResponse', 'recurrence'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in fields) {
        sets.push(`${key} = ?`);
        values.push(fields[key] ?? null);
      }
    }
    if (sets.length === 0) return false;
    values.push(id, parentId);
    const result = db.prepare(`UPDATE homework SET ${sets.join(', ')} WHERE id = ? AND parentId = ?`).run(...values);
    return result.changes > 0;
  },

  remove(id: string, parentId: string): boolean {
    const result = db.prepare('DELETE FROM homework WHERE id = ? AND parentId = ?').run(id, parentId);
    return result.changes > 0;
  },
};
