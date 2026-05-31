import { describe, it, expect } from 'vitest';
import { matchesEntityFilter } from './useSocket';

describe('matchesEntityFilter', () => {
  it('matches when entity in filter list', () => {
    expect(matchesEntityFilter(['tasks', 'completions'], { entity: 'tasks' })).toBe(true);
  });

  it('does not match when entity not in filter list', () => {
    expect(matchesEntityFilter(['tasks', 'completions'], { entity: 'events' })).toBe(false);
  });

  it('matches when filter includes all', () => {
    expect(matchesEntityFilter(['all'], { entity: 'events' })).toBe(true);
    expect(matchesEntityFilter(['all'], { entity: 'tasks' })).toBe(true);
  });

  it('matches when entity is all broadcast', () => {
    expect(matchesEntityFilter(['tasks'], { entity: 'all' })).toBe(true);
  });

  it('undefined entity treated as all broadcast', () => {
    expect(matchesEntityFilter(['tasks'], {})).toBe(true);
  });

  it('falls back to type field when entity absent', () => {
    expect(matchesEntityFilter(['events'], { type: 'events' })).toBe(true);
    expect(matchesEntityFilter(['tasks'], { type: 'events' })).toBe(false);
  });
});
