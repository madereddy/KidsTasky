import { describe, it, expect } from 'vitest';
import {
  calculateStreakUpdate,
  getXpMultiplier,
  evaluateBadges,
} from './streakService.js';

describe('calculateStreakUpdate', () => {
  it('increments streak when completing on next day', () => {
    const result = calculateStreakUpdate('2026-06-10', '2026-06-11', 3, 3);
    expect(result.newStreak).toBe(4);
    expect(result.newLongest).toBe(4);
  });

  it('keeps streak at 1 when completing same day', () => {
    const result = calculateStreakUpdate('2026-06-11', '2026-06-11', 2, 2);
    expect(result.newStreak).toBe(2); // no change — already counted today
  });

  it('resets streak to 1 when gap > 1 day', () => {
    const result = calculateStreakUpdate('2026-06-09', '2026-06-11', 5, 5);
    expect(result.newStreak).toBe(1);
    expect(result.newLongest).toBe(5); // longest preserved
  });

  it('starts streak at 1 when lastMissionDate is null', () => {
    const result = calculateStreakUpdate(null, '2026-06-11', 0, 0);
    expect(result.newStreak).toBe(1);
    expect(result.newLongest).toBe(1);
  });
});

describe('getXpMultiplier', () => {
  it('returns 1 for streak below 3', () => expect(getXpMultiplier(2)).toBe(1));
  it('returns 1.5 for streak 3–6', () => expect(getXpMultiplier(3)).toBe(1.5));
  it('returns 2 for streak 7+', () => expect(getXpMultiplier(7)).toBe(2));
});

describe('evaluateBadges', () => {
  it('awards streak_3 at streak 3', () => {
    expect(evaluateBadges({ streak: 3, completions: 0, powerMissions: 0, isFamilyMvp: false }))
      .toContain('streak_3');
  });
  it('awards on_fire at streak 7', () => {
    expect(evaluateBadges({ streak: 7, completions: 0, powerMissions: 0, isFamilyMvp: false }))
      .toContain('on_fire');
  });
  it('awards century at 100 completions', () => {
    expect(evaluateBadges({ streak: 0, completions: 100, powerMissions: 0, isFamilyMvp: false }))
      .toContain('century');
  });
  it('awards power_chaser at 5 power missions', () => {
    expect(evaluateBadges({ streak: 0, completions: 0, powerMissions: 5, isFamilyMvp: false }))
      .toContain('power_chaser');
  });
  it('awards family_mvp when isFamilyMvp is true', () => {
    expect(evaluateBadges({ streak: 0, completions: 0, powerMissions: 0, isFamilyMvp: true }))
      .toContain('family_mvp');
  });
  it('returns empty array when no thresholds met', () => {
    expect(evaluateBadges({ streak: 1, completions: 5, powerMissions: 0, isFamilyMvp: false }))
      .toEqual([]);
  });
});
