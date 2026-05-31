import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WeeklyChoreGrid } from './WeeklyChoreGrid';
import type { Task, UserProfile, TaskCompletion } from '../../types';

const mockKids: UserProfile[] = [
  { uid: 'kid1', name: 'Alice', role: 'kid', email: '', color: '#ff0000' },
  { uid: 'kid2', name: 'Bob', role: 'kid', email: '', color: '#0000ff' },
];

const mockTasks: Task[] = [
  { id: 't1', title: 'Make Bed', assignedKidId: 'kid1', parentId: 'p1', frequency: 'daily', status: 'active', createdAt: 0 },
  { id: 't2', title: 'Take Out Trash', assignedKidId: 'kid2', parentId: 'p1', frequency: 'daily', status: 'active', createdAt: 0 },
];

const mockCompletions: TaskCompletion[] = [
  { id: 'c1', taskId: 't1', kidId: 'kid1', completedAt: 0, dateString: '2026-05-25' },
];

describe('WeeklyChoreGrid', () => {
  it('renders chore rows for each kid', () => {
    render(<WeeklyChoreGrid tasks={mockTasks} kids={mockKids} completions={mockCompletions} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows task title', () => {
    render(<WeeklyChoreGrid tasks={mockTasks} kids={mockKids} completions={mockCompletions} />);
    expect(screen.getByText('Make Bed')).toBeInTheDocument();
  });

  it('shows completed indicator for done task', () => {
    render(<WeeklyChoreGrid tasks={mockTasks} kids={mockKids} completions={mockCompletions} weekStart={new Date('2026-05-25T12:00:00')} />);
    const completedDots = screen.getAllByTestId('chore-complete');
    expect(completedDots.length).toBeGreaterThan(0);
  });

  it('shows pending indicator for incomplete task', () => {
    render(<WeeklyChoreGrid tasks={mockTasks} kids={mockKids} completions={[]} weekStart={new Date('2026-05-25T12:00:00')} />);
    const pendingDots = screen.getAllByTestId('chore-pending');
    expect(pendingDots.length).toBeGreaterThan(0);
  });
});
