import type { WallMode } from '../types.js';

// Returns the wall display mode based on time of day.
// morning 6–9, ambient 9–15, afterschool 15–18, evening 18–21, night 21–6
export function getCurrentWallMode(now: Date = new Date()): WallMode {
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  if (totalMinutes >= 6 * 60 && totalMinutes < 9 * 60) return 'morning';
  if (totalMinutes >= 9 * 60 && totalMinutes < 15 * 60) return 'ambient';
  if (totalMinutes >= 15 * 60 && totalMinutes < 18 * 60) return 'afterschool';
  if (totalMinutes >= 18 * 60 && totalMinutes < 21 * 60) return 'evening';
  return 'night';
}
