// src/components/lists/ListSidebar.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ListSidebar } from './ListSidebar';

describe('ListSidebar', () => {
  it('renders list items and handles toggle', () => {
    const onToggle = vi.fn();
    const items = [{ id: '1', listId: 'l1', text: 'Apples', completed: 0 }];
    
    render(<ListSidebar listTitle="Groceries" items={items} onToggleItem={onToggle} isOpen={true} />);
    
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Apples')).toBeInTheDocument();
    
    // Find checkbox input and click
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    expect(onToggle).toHaveBeenCalledWith('1', true);
  });
});
