import { db } from '../../db.js';

interface StreakUpdateResult {
  newStreak: number;
  newLongest: number;
}

// Returns updated streak values given the last mission date and today's date string (YYYY-MM-DD).
// "Same day" completions don't increment the streak — streak increments once per calendar day.
export function calculateStreakUpdate(
  lastMissionDate: string | null,
  today: string,
  currentStreak: number,
  longestStreak: number
): StreakUpdateResult {
  if (!lastMissionDate) {
    return { newStreak: 1, newLongest: Math.max(longestStreak, 1) };
  }
  if (lastMissionDate === today) {
    return { newStreak: currentStreak, newLongest: longestStreak };
  }
  const last = new Date(lastMissionDate);
  const todayDate = new Date(today);
  const diffDays = Math.round((todayDate.getTime() - last.getTime()) / 86400000);
  if (diffDays === 1) {
    const newStreak = currentStreak + 1;
    return { newStreak, newLongest: Math.max(longestStreak, newStreak) };
  }
  // Gap > 1 day — streak broken
  return { newStreak: 1, newLongest: longestStreak };
}

export function getXpMultiplier(streak: number): number {
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

interface BadgeInput {
  streak: number;
  completions: number;
  powerMissions: number;
  isFamilyMvp: boolean;
}

// Returns badge keys earned based on current stats.
// Caller should diff against existing badges to find truly new ones.
export function evaluateBadges(input: BadgeInput): string[] {
  const earned: string[] = [];
  if (input.streak >= 3) earned.push('streak_3');
  if (input.streak >= 7) earned.push('on_fire');
  if (input.completions >= 100) earned.push('century');
  if (input.powerMissions >= 5) earned.push('power_chaser');
  if (input.isFamilyMvp) earned.push('family_mvp');
  return earned;
}

export function writeXpEvent(userId: string, parentId: string, xp: number, reason: string): void {
  db.prepare(
    'INSERT INTO xp_events (userId, parentId, xp, reason, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, parentId, xp, reason, new Date().toISOString());
}

export function getWeeklyXp(parentId: string, weekStart: string, weekEnd: string): Array<{ userId: string; totalXp: number }> {
  return db.prepare(`
    SELECT userId, SUM(xp) AS totalXp
    FROM xp_events
    WHERE parentId = ? AND createdAt >= ? AND createdAt < ?
    GROUP BY userId
    ORDER BY totalXp DESC
  `).all(parentId, weekStart, weekEnd) as Array<{ userId: string; totalXp: number }>;
}
