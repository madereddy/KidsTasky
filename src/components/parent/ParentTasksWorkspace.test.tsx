// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentTasksWorkspace } from './ParentTasksWorkspace';

const getPendingCompletions = vi.fn();
const approveCompletion = vi.fn();
const rejectCompletion = vi.fn();
const uncompleteTask = vi.fn();
const createTask = vi.fn();
const archiveTask = vi.fn();
const updateTask = vi.fn();

vi.mock('../../services/tasks', () => ({
  tasksClientService: {
    getPendingCompletions: (...args: any[]) => getPendingCompletions(...args),
    approveCompletion: (...args: any[]) => approveCompletion(...args),
    rejectCompletion: (...args: any[]) => rejectCompletion(...args),
    uncompleteTask: (...args: any[]) => uncompleteTask(...args),
    createTask: (...args: any[]) => createTask(...args),
    archiveTask: (...args: any[]) => archiveTask(...args),
    updateTask: (...args: any[]) => updateTask(...args),
  },
}));

vi.mock('../../services/dashboard', () => ({
  dashboardClientService: {
    getFamilyDashboardData: vi.fn(),
    clearCache: vi.fn(),
  },
}));

import { dashboardClientService } from '../../services/dashboard';

vi.mock('../../hooks/useSocket', () => ({
  useSocketStaleData: vi.fn(),
}));

vi.mock('./ParentTaskBoard', () => ({
  ParentTaskBoard: () => <div data-testid="parent-task-board" />,
}));

vi.mock('./ChoreChart', () => ({
  ChoreChart: () => <div data-testid="parent-chart" />,
}));

vi.mock('./AddTaskModal', () => ({
  AddTaskModal: () => <div data-testid="add-task-modal" />,
}));

vi.mock('./CategoryManager', () => ({
  CategoryManager: () => <div data-testid="category-manager" />,
}));

vi.mock('../homework/HomeworkView', () => ({
  HomeworkView: () => <div data-testid="parent-homework-view" />,
}));

const kids: any[] = [
  { uid: 'k1', name: 'Kid One', role: 'kid', email: 'k1@test.com' },
];

describe('ParentTasksWorkspace workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTask.mockResolvedValue('new-task');
    archiveTask.mockResolvedValue(undefined);
    updateTask.mockResolvedValue(undefined);
    rejectCompletion.mockResolvedValue(undefined);
  });

  it('renders parent approval and undo flows against persisted completion data', async () => {
    const today = new Date().toISOString().slice(0, 10);
    let pendingRows: any[] = [
      {
        id: 'pc1',
        taskId: 't-pending',
        taskTitle: 'Pack Lunch',
        kidName: 'Kid One',
        kidId: 'k1',
        dateString: today,
        completedAt: { seconds: 10 },
        approvalStatus: 'pending',
      },
    ];

    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({
      tasks: [
        { id: 't-pending', title: 'Pack Lunch' },
        { id: 't-approved', title: 'Brush Teeth' },
      ],
      completions: [
        {
          id: 'ac1',
          taskId: 't-approved',
          kidId: 'k1',
          dateString: today,
          completedAt: { seconds: 20 },
          approvalStatus: 'approved',
        },
      ],
      events: [],
      homework: [],
    } as any);
    getPendingCompletions.mockImplementation(async () => pendingRows);
    approveCompletion.mockImplementation(async (completionId: string) => {
      pendingRows = pendingRows.filter((row) => row.id !== completionId);
    });
    uncompleteTask.mockResolvedValue(undefined);

    render(
      <ParentTasksWorkspace
        parentId="p1"
        kids={kids}
        categories={[]}
        selectedCategoryId={null}
        onCategoriesChange={() => {}}
      />,
    );

    expect(await screen.findByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Completed Today')).toBeInTheDocument();
    expect(screen.getByText('Pack Lunch')).toBeInTheDocument();
    expect(screen.getByText('Brush Teeth')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await waitFor(() => expect(screen.getAllByText('Pack Lunch').length).toBe(1));
    expect(screen.getByText('Completed Today')).toBeInTheDocument();

    const packLunchCard = screen.getByText('Pack Lunch').closest('div[class*="bg-white p-4"]');
    expect(packLunchCard).not.toBeNull();
    fireEvent.click(within(packLunchCard as HTMLElement).getByRole('button', { name: /^Undo$/i }));
    await waitFor(() => expect(screen.queryByText('Pack Lunch')).not.toBeInTheDocument());
  });
});
