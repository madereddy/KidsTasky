import { randomUUID } from 'crypto';
import { db } from '../../db.js';

export type ProofTemplateKind = 'task' | 'homework' | 'list';
export type ProofTemplate = {
  id: string;
  parentId: string;
  kind: ProofTemplateKind;
  name: string;
  questions: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

function parseQuestions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((q) => String(q).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export const proofTemplatesService = {
  list(parentId: string, kind: ProofTemplateKind): ProofTemplate[] {
    const rows = db.prepare(
      `SELECT * FROM proof_templates WHERE parentId = ? AND kind = ? ORDER BY pinned DESC, updatedAt DESC, name ASC`
    ).all(parentId, kind) as any[];
    return rows.map((row) => ({
      id: String(row.id),
      parentId: String(row.parentId),
      kind: row.kind,
      name: String(row.name),
      questions: parseQuestions(String(row.questionsJson || '[]')),
      pinned: Boolean(row.pinned),
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    }));
  },

  upsert(parentId: string, kind: ProofTemplateKind, name: string, questions: string[], pinned = false): ProofTemplate {
    const now = Date.now();
    const id = `${kind}_${randomUUID()}`;
    db.prepare(`
      INSERT INTO proof_templates (id, parentId, kind, name, questionsJson, pinned, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(parentId, kind, name) DO UPDATE SET
        questionsJson = excluded.questionsJson,
        pinned = excluded.pinned,
        updatedAt = excluded.updatedAt
    `).run(id, parentId, kind, name, JSON.stringify(questions), pinned ? 1 : 0, now, now);

    const row = db.prepare(
      `SELECT * FROM proof_templates WHERE parentId = ? AND kind = ? AND name = ?`
    ).get(parentId, kind, name) as any;
    return {
      id: String(row.id),
      parentId: String(row.parentId),
      kind: row.kind,
      name: String(row.name),
      questions: parseQuestions(String(row.questionsJson || '[]')),
      pinned: Boolean(row.pinned),
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    };
  },

  remove(parentId: string, kind: ProofTemplateKind, id: string): boolean {
    const result = db.prepare(`DELETE FROM proof_templates WHERE id = ? AND parentId = ? AND kind = ?`).run(id, parentId, kind);
    return result.changes > 0;
  },

  setPinned(parentId: string, kind: ProofTemplateKind, id: string, pinned: boolean): boolean {
    const result = db.prepare(`
      UPDATE proof_templates
      SET pinned = ?, updatedAt = ?
      WHERE id = ? AND parentId = ? AND kind = ?
    `).run(pinned ? 1 : 0, Date.now(), id, parentId, kind);
    return result.changes > 0;
  },
};
