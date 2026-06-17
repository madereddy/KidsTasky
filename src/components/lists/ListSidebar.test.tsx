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

  it('can hide the embedded header when the parent screen already renders the list title', () => {
    render(
      <ListSidebar
        listTitle="Morning Routine"
        items={[{ id: '1', listId: 'routine-1', text: 'Brush teeth', completed: 0 }]}
        onToggleItem={vi.fn()}
        isOpen={true}
        hideHeader={true}
      />
    );

    expect(screen.queryByRole('heading', { name: 'Morning Routine' })).not.toBeInTheDocument();
    expect(screen.getByText('Brush teeth')).toBeInTheDocument();
  });

  it('supports mobile checklist taps for routine items', () => {
    const onToggle = vi.fn();

    render(
      <ListSidebar
        listTitle="Morning Routine"
        items={[{ id: '1', listId: 'routine-1', text: 'Pack backpack', completed: 0 }]}
        onToggleItem={onToggle}
        isOpen={true}
        hideHeader={true}
        mobileChecklistMode={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /pack backpack/i }));

    expect(onToggle).toHaveBeenCalledWith('1', true);
  });
});
