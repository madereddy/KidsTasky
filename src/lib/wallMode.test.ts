import { describe, it, expect } from 'vitest';
import { getCurrentWallMode } from './wallMode.js';

const at = (hour: number, minute = 0) => {
  const d = new Date(2026, 0, 1);
  d.setHours(hour, minute, 0, 0);
  return d;
};

describe('getCurrentWallMode', () => {
  it('returns morning at 6:00', () => expect(getCurrentWallMode(at(6))).toBe('morning'));
  it('returns morning at 8:59', () => expect(getCurrentWallMode(at(8, 59))).toBe('morning'));
  it('returns ambient at 9:00', () => expect(getCurrentWallMode(at(9))).toBe('ambient'));
  it('returns ambient at 14:59', () => expect(getCurrentWallMode(at(14, 59))).toBe('ambient'));
  it('returns afterschool at 15:00', () => expect(getCurrentWallMode(at(15))).toBe('afterschool'));
  it('returns afterschool at 17:59', () => expect(getCurrentWallMode(at(17, 59))).toBe('afterschool'));
  it('returns evening at 18:00', () => expect(getCurrentWallMode(at(18))).toBe('evening'));
  it('returns evening at 20:59', () => expect(getCurrentWallMode(at(20, 59))).toBe('evening'));
  it('returns night at 21:00', () => expect(getCurrentWallMode(at(21))).toBe('night'));
  it('returns night at 5:59', () => expect(getCurrentWallMode(at(5, 59))).toBe('night'));
});
