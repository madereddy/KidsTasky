import { db } from '../../db.js';

export const KNOWN_FLAGS = ['wall_v2_layout', 'sync_diagnostics', 'calendar_visibility_profiles'] as const;
export type FlagName = typeof KNOWN_FLAGS[number];

export interface FlagRow {
  flag: FlagName;
  enabled: boolean;
}

function makeId(parentId: string, flag: string): string {
  return `${parentId}_${flag}`;
}

export const flagsService = {
  getFlags: (parentId: string): Record<FlagName, boolean> => {
    const rows = db.prepare('SELECT flag, enabled FROM feature_flags WHERE parentId = ?').all(parentId) as Array<{ flag: string; enabled: number }>;
    const stored = new Map(rows.map((r) => [r.flag, Boolean(r.enabled)]));
    const result = {} as Record<FlagName, boolean>;
    for (const flag of KNOWN_FLAGS) {
      result[flag] = stored.has(flag) ? stored.get(flag)! : true;
    }
    return result;
  },

  setFlag: (parentId: string, flag: FlagName, enabled: boolean): void => {
    const id = makeId(parentId, flag);
    db.prepare(`
      INSERT INTO feature_flags (id, parentId, flag, enabled, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(parentId, flag) DO UPDATE SET enabled = excluded.enabled, updatedAt = excluded.updatedAt
    `).run(id, parentId, flag, enabled ? 1 : 0, Date.now());
  },
};
