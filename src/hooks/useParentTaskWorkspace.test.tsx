// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParentTaskWorkspace } from './useParentTaskWorkspace';

vi.mock('../services/tasks', () => ({
  tasksClientService: {
    getTasksForParent: vi.fn(),
    getPendingCompletions: vi.fn(),
    getCompletionsForKid: vi.fn(),
    createTask: vi.fn(),
    archiveTask: vi.fn(),
    updateTask: vi.fn(),
    approveCompletion: vi.fn(),
    rejectCompletion: vi.fn(),
    uncompleteTask: vi.fn(),
  },
}));

import { tasksClientService } from '../services/tasks';

describe('useParentTaskWorkspace', () => {
  const kids: any[] = [
    { uid: 'k1', name: 'Kid One' },
    { uid: 'k2', name: 'Kid Two' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksClientService.getTasksForParent).mockResolvedValue([
      { id: 't1', title: 'Brush teeth', assignedKidId: 'k1', parentId: 'p1', frequency: 'daily', status: 'active', createdAt: 1 },
    ] as any);
    vi.mocked(tasksClientService.getPendingCompletions).mockResolvedValue([
      { id: 'pc1', taskId: 't1', kidName: 'Kid One', taskTitle: 'Brush teeth' },
    ] as any);
    vi.mocked(tasksClientService.getCompletionsForKid)
      .mockResolvedValueOnce([{ id: 'c1', taskId: 't1', kidId: 'k1', dateString: '2026-06-03', completedAt: { seconds: 20 } }] as any)
      .mockResolvedValueOnce([] as any);
  });

  it('loads tasks, pending approvals, and completed-today summaries', async () => {
    const { result } = renderHook(() => useParentTaskWorkspace({ parentId: 'p1', kids }));

    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.pendingCompletions).toHaveLength(1);
    expect(result.current.todayApprovedCompletions[0]).toMatchObject({
      taskId: 't1',
      kidName: 'Kid One',
      taskTitle: 'Brush teeth',
    });
  });

  it('approves and moves a pending completion into completed today locally', async () => {
    const { result } = renderHook(() => useParentTaskWorkspace({ parentId: 'p1', kids }));
    await waitFor(() => expect(result.current.pendingCompletions).toHaveLength(1));

    await act(async () => {
      await result.current.approveCompletion('pc1');
    });

    expect(tasksClientService.approveCompletion).toHaveBeenCalledWith('pc1');
    expect(result.current.pendingCompletions).toHaveLength(0);
    expect(result.current.todayApprovedCompletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 't1',
          approvalStatus: 'approved',
          kidName: 'Kid One',
          taskTitle: 'Brush teeth',
        }),
      ]),
    );
  });
});
