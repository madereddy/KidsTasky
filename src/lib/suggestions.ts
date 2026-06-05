import { UserProfile } from '../types';

export type Suggestion = {
  id: string;
  label: string;
  type: 'who' | 'when' | 'where';
  value: string;
};

export function getQuickEntrySuggestions(
  text: string,
  kids: UserProfile[],
  history: any[] = []
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lowerText = text.toLowerCase();

  // Who suggestions: only if not already @someone
  if (!text.includes('@')) {
    kids.forEach(kid => {
      suggestions.push({
        id: `who-${kid.uid}`,
        label: kid.name,
        type: 'who',
        value: `@${kid.name}`
      });
    });
  }

  // When suggestions: only if not already !time
  if (!text.includes('!')) {
    // Add some common defaults
    suggestions.push({ id: 'when-today', label: 'Today', type: 'when', value: '!today' });
    suggestions.push({ id: 'when-tonight', label: 'Tonight', type: 'when', value: '!tonight' });
    suggestions.push({ id: 'when-tomorrow', label: 'Tomorrow', type: 'when', value: '!tomorrow' });
  }

  // Filter based on existing text if needed (basic for now)
  return suggestions.slice(0, 5);
}
