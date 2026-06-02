// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { xpForLevel, levelForXp, xpProgress, MAX_LEVEL } from './xp';

describe('RuneScape-style XP curve', () => {
  it('matches known RuneScape thresholds', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(3)).toBe(174);
    expect(xpForLevel(10)).toBe(1154);
    expect(xpForLevel(99)).toBe(13034431);
  });

  it('gets progressively harder — each level costs more than the last', () => {
    let prevSpan = 0;
    for (let level = 2; level <= 30; level++) {
      const span = xpForLevel(level) - xpForLevel(level - 1);
      expect(span).toBeGreaterThan(prevSpan);
      prevSpan = span;
    }
  });

  it('levelForXp returns the highest level the XP qualifies for', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(82)).toBe(1);
    expect(levelForXp(83)).toBe(2);
    expect(levelForXp(173)).toBe(2);
    expect(levelForXp(174)).toBe(3);
  });

  it('clamps and sanitizes bad input', () => {
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(NaN)).toBe(1);
    expect(levelForXp(undefined as any)).toBe(1);
  });

  it('caps at MAX_LEVEL', () => {
    expect(levelForXp(999_999_999)).toBe(MAX_LEVEL);
    const p = xpProgress(999_999_999);
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.percent).toBe(100);
    expect(p.xpToNext).toBe(0);
  });

  it('xpProgress reports position within the current level', () => {
    // 100 XP -> level 2 (needs 83), next level 3 needs 174.
    const p = xpProgress(100);
    expect(p.level).toBe(2);
    expect(p.xpIntoLevel).toBe(100 - 83);     // 17
    expect(p.xpForLevelSpan).toBe(174 - 83);  // 91
    expect(p.xpToNext).toBe(174 - 100);       // 74
    expect(p.percent).toBe(Math.round((17 / 91) * 100));
  });
});
