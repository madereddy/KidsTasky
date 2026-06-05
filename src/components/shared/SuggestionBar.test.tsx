import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionBar } from './SuggestionBar';
import { Suggestion } from '../../lib/suggestions';
import { describe, it, expect, vi } from 'vitest';

describe('SuggestionBar', () => {
  const mockSuggestions: Suggestion[] = [
    { id: '1', label: 'Kid 1', type: 'who', value: '@Kid 1' },
    { id: '2', label: 'Today', type: 'when', value: '!today' },
  ];

  it('renders suggestions', () => {
    render(<SuggestionBar suggestions={mockSuggestions} onSelect={() => {}} />);
    
    expect(screen.getByText('Kid 1')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
  });

  it('calls onSelect when a suggestion is clicked', () => {
    const onSelect = vi.fn();
    render(<SuggestionBar suggestions={mockSuggestions} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('Kid 1'));
    expect(onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
  });

  it('returns null when no suggestions', () => {
    const { container } = render(<SuggestionBar suggestions={[]} onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
