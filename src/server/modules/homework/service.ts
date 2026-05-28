import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { Homework } from '../../../types.js';

type HomeworkUpdate = Partial<Pick<Homework, 'title' | 'subject' | 'notes' | 'dueDate' | 'assignedToId' | 'status' | 'color'>>;

export const homeworkService = {
  create(data: Omit<Homework, 'id' | 'createdAt'>): string {
    const id = 'hw_' + randomUUID();
    db.prepare(`
      INSERT INTO homework (id, parentId, title, subject, notes, dueDate, assignedToId, status, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.parentId, data.title, data.subject, data.notes ?? null, data.dueDate, data.assignedToId ?? null, data.status ?? 'pending', data.color);
    return id;
  },

  getByParent(parentId: string): Homework[] {
    return db.prepare('SELECT * FROM homework WHERE parentId = ? ORDER BY dueDate ASC, createdAt DESC').all(parentId) as Homework[];
  },

  getById(id: string): Homework | undefined {
    return db.prepare('SELECT * FROM homework WHERE id = ?').get(id) as Homework | undefined;
  },

  update(id: string, parentId: string, fields: HomeworkUpdate): boolean {
    const allowed: Array<keyof HomeworkUpdate> = ['title', 'subject', 'notes', 'dueDate', 'assignedToId', 'status', 'color'];
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
