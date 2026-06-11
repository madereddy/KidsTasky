// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MissionTodayView } from './MissionTodayView';

vi.mock('./SwipeableRow', () => ({
  SwipeableRow: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div onClick={onClick}>{children}</div>
  ),
}));
import { UserProfile, Task, CalendarEvent, AppListItem, AppList, Category, TaskCompletion } from '../../types';

const mockProfile: UserProfile = {
  uid: 'user1',
  role: 'kid',
  name: 'Test Kid',
  email: 'test@example.com',
};

const mockLists: AppList[] = [
  {
    id: 'routine1',
    parentId: 'parent1',
    title: 'Morning Routine',
    isRoutine: 1,
    category: 'routine',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const mockListItems: AppListItem[] = [
  {
    id: 'item1',
    listId: 'routine1',
    text: 'Brush Teeth',
    completed: 0,
  },
  {
    id: 'item2',
    listId: 'routine1',
    text: 'Make Bed',
    completed: 0,
  }
];

describe('MissionTodayView', () => {
  it('renders routine summary and expands on click', () => {
    const onAction = vi.fn();
    render(
      <MissionTodayView
        profile={mockProfile}
        tasks={[]}
        events={[]}
        completions={[]}
        listItems={mockListItems}
        lists={mockLists}
        kids={[]}
        categories={[]}
        onAction={onAction}
      />
    );

    // Should show routine summary
    expect(screen.getByText('Morning Routine')).toBeInTheDocument();
    expect(screen.getByText('2 items remaining')).toBeInTheDocument();

    // Individual items should NOT be in the document initially (grouped)
    expect(screen.queryByText('Brush Teeth')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Morning Routine'));

    // Now items should be visible
    expect(screen.getByText('Brush Teeth')).toBeInTheDocument();
    expect(screen.getByText('Make Bed')).toBeInTheDocument();
    expect(screen.getByText('COMPLETE ALL')).toBeInTheDocument();
  });

  it('calls onAction when sub-item is clicked', () => {
    const onAction = vi.fn();
    render(
      <MissionTodayView
        profile={mockProfile}
        tasks={[]}
        events={[]}
        completions={[]}
        listItems={mockListItems}
        lists={mockLists}
        kids={[]}
        categories={[]}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText('Morning Routine'));
    fireEvent.click(screen.getByText('Brush Teeth'));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'list_item1',
        title: 'Brush Teeth'
      }),
      'complete'
    );
  });

  it('calls onAction for all items when COMPLETE ALL is clicked', () => {
    const onAction = vi.fn();
    render(
      <MissionTodayView
        profile={mockProfile}
        tasks={[]}
        events={[]}
        completions={[]}
        listItems={mockListItems}
        lists={mockLists}
        kids={[]}
        categories={[]}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText('Morning Routine'));
    fireEvent.click(screen.getByText('COMPLETE ALL'));

    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'list_item1' }),
      'complete'
    );
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'list_item2' }),
      'complete'
    );
  });
});
