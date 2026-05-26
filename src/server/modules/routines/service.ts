import { db } from '../../db.js';
import { RoutineTemplate } from '../../../types.js';

import { randomUUID } from 'crypto';

export const routinesService = {
  getTemplates: (parentId: string): RoutineTemplate[] => {
    return db.prepare('SELECT * FROM routine_templates WHERE parentId = ? ORDER BY createdAt ASC').all(parentId) as RoutineTemplate[];
  },

  createTemplate: (data: Omit<RoutineTemplate, 'id' | 'createdAt'>) => {
    const id = 'routine_' + randomUUID();
    db.prepare(`
      INSERT INTO routine_templates (id, parentId, title, description, defaultStartTime, defaultDuration, assignedToId, color, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.parentId, data.title, data.description ?? null, data.defaultStartTime ?? null, data.defaultDuration ?? 3600000, data.assignedToId ?? null, data.color ?? '#6366f1', Date.now());
    return id;
  },

  deleteTemplate: (id: string) => {
    db.prepare('DELETE FROM routine_templates WHERE id = ?').run(id);
  },

  getTemplateById: (id: string): RoutineTemplate | undefined => {
    return db.prepare('SELECT * FROM routine_templates WHERE id = ?').get(id) as RoutineTemplate | undefined;
  },
};
