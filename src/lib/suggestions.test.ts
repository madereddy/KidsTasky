import { describe, it, expect } from 'vitest';
import { getQuickEntrySuggestions } from './suggestions';
import { UserProfile } from '../types';

describe('getQuickEntrySuggestions', () => {
  const mockKids: UserProfile[] = [
    { uid: '1', name: 'Alice', role: 'kid', email: 'alice@example.com' },
    { uid: '2', name: 'Bob', role: 'kid', email: 'bob@example.com' },
  ];

  it('suggests kids when no @ is present', () => {
    const suggestions = getQuickEntrySuggestions('', mockKids);
    const whoSuggestions = suggestions.filter(s => s.type === 'who');
    
    expect(whoSuggestions).toHaveLength(2);
    expect(whoSuggestions[0].label).toBe('Alice');
    expect(whoSuggestions[0].value).toBe('@Alice');
    expect(whoSuggestions[1].label).toBe('Bob');
    expect(whoSuggestions[1].value).toBe('@Bob');
  });

  it('does not suggest kids when @ is already present', () => {
    const suggestions = getQuickEntrySuggestions('@Alice ', mockKids);
    const whoSuggestions = suggestions.filter(s => s.type === 'who');
    
    expect(whoSuggestions).toHaveLength(0);
  });

  it('suggests time shortcuts when no ! is present', () => {
    const suggestions = getQuickEntrySuggestions('', mockKids);
    const whenSuggestions = suggestions.filter(s => s.type === 'when');
    
    expect(whenSuggestions).toContainEqual(expect.objectContaining({ value: '!today' }));
    expect(whenSuggestions).toContainEqual(expect.objectContaining({ value: '!tonight' }));
    expect(whenSuggestions).toContainEqual(expect.objectContaining({ value: '!tomorrow' }));
  });

  it('does not suggest time shortcuts when ! is already present', () => {
    const suggestions = getQuickEntrySuggestions('Clean room !today ', mockKids);
    const whenSuggestions = suggestions.filter(s => s.type === 'when');
    
    expect(whenSuggestions).toHaveLength(0);
  });

  it('limits total suggestions to 5', () => {
    const manyKids: UserProfile[] = Array.from({ length: 10 }, (_, i) => ({
      uid: `${i}`,
      name: `Kid ${i}`,
      role: 'kid',
      email: `kid${i}@example.com`
    }));
    
    const suggestions = getQuickEntrySuggestions('', manyKids);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });
});
