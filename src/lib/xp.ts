// RuneScape-style experience curve.
//
// Each level costs more XP than the last, so progress slows as kids level up
// (mirrors the classic OSRS skill curve). Shared by the server (authoritative
// level computation) and the client (level + progress display) so both agree.
//
// Genuine RuneScape formula for the XP required to *reach* a level L:
//   xp(L) = floor( (1/4) * sum_{n=1}^{L-1} floor(n + 300 * 2^(n/7)) )
// Level 1 = 0 XP, Level 2 = 83 XP, ... Level 99 = 13,034,431 XP.

export const MAX_LEVEL = 99;

function rsCumulativeXp(level: number): number {
  if (level <= 1) return 0;
  let points = 0;
  for (let n = 1; n < level; n++) {
    points += Math.floor(n + 300 * Math.pow(2, n / 7));
  }
  return Math.floor(points / 4);
}

// Precomputed cumulative XP thresholds, indexed by level (XP_TABLE[1] === 0).
const XP_TABLE: number[] = (() => {
  const table = new Array<number>(MAX_LEVEL + 1);
  for (let level = 1; level <= MAX_LEVEL; level++) {
    table[level] = rsCumulativeXp(level);
  }
  return table;
})();

/** Total cumulative XP required to reach a given level. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return XP_TABLE[MAX_LEVEL];
  return XP_TABLE[level];
}

/** Highest level a given total XP qualifies for. */
export function levelForXp(xp: number): number {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  for (let l = 2; l <= MAX_LEVEL; l++) {
    if (x >= XP_TABLE[l]) level = l;
    else break;
  }
  return level;
}

export interface XpProgress {
  level: number;
  xpIntoLevel: number;   // XP earned past the current level threshold
  xpForLevelSpan: number; // XP needed to span the current level
  xpToNext: number;       // XP remaining to reach the next level
  percent: number;        // 0-100 progress through the current level
}

/** Progress breakdown for a given total XP — drives level bars in the UI. */
export function xpProgress(xp: number): XpProgress {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelForXp(x);
  if (level >= MAX_LEVEL) {
    return { level, xpIntoLevel: 0, xpForLevelSpan: 0, xpToNext: 0, percent: 100 };
  }
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - base;
  const into = x - base;
  return {
    level,
    xpIntoLevel: into,
    xpForLevelSpan: span,
    xpToNext: next - x,
    percent: span > 0 ? Math.round((into / span) * 100) : 0,
  };
}
