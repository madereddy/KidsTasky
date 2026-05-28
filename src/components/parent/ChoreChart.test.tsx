// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChoreChart } from './ChoreChart';
import { Category, Task, UserProfile } from '../../types';

const kids: UserProfile[] = [
  { uid: 'k1', name: 'Alice', role: 'kid', email: 'alice@test.com', parentId: 'p1' },
  { uid: 'k2', name: 'Bob', role: 'kid', email: 'bob@test.com', parentId: 'p1' },
];

const tasks: Task[] = [
  { id: 't1', title: 'Dishes', assignedKidId: 'k1', parentId: 'p1', status: 'active', frequency: 'daily', createdAt: Date.now() },
  { id: 't2', title: 'Vacuum', assignedKidId: 'all', parentId: 'p1', status: 'active', frequency: 'daily', createdAt: Date.now() },
];

describe('ChoreChart', () => {
  it('renders kid names as column headers', () => {
    render(<ChoreChart tasks={tasks} kids={kids} categories={[] as Category[]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders task titles as row headers', () => {
    render(<ChoreChart tasks={tasks} kids={kids} categories={[] as Category[]} />);
    expect(screen.getByText('Dishes')).toBeInTheDocument();
    expect(screen.getByText('Vacuum')).toBeInTheDocument();
  });
});
