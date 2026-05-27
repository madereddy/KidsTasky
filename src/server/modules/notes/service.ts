import { db } from '../../db.js';

export const notesService = {
  getNote: (parentId: string): { content: string; updatedByName: string; updatedAt: number } => {
    const row = db.prepare('SELECT content, updatedByName, updatedAt FROM family_notes WHERE parentId = ?')
      .get(parentId) as any;
    return row ?? { content: '', updatedByName: '', updatedAt: 0 };
  },

  upsertNote: (parentId: string, content: string, updatedByName: string): void => {
    const id = `note_${parentId}`;
    db.prepare(`
      INSERT INTO family_notes (id, parentId, content, updatedByName, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(parentId) DO UPDATE SET
        content = excluded.content,
        updatedByName = excluded.updatedByName,
        updatedAt = excluded.updatedAt
    `).run(id, parentId, content, updatedByName, Date.now());
  },
};