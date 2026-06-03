// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKidProgress } from './useKidProgress';

vi.mock('../services/tasks', () => ({
  tasksClientService: {
    getCompletionsForDateRange: vi.fn(),
  },
}));

import { tasksClientService } from '../services/tasks';

describe('useKidProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z'));
    vi.mocked(tasksClientService.getCompletionsForDateRange).mockResolvedValue([] as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives filtered tasks and progress percent from current day state', () => {
    const tasks: any[] = [
      { id: 't1', title: 'A', frequency: 'daily', assignedKidId: 'k1', parentId: 'p1', status: 'active', createdAt: 1, categoryId: 'cat-1', reminderTime: '09:00' },
      { id: 't2', title: 'B', frequency: 'twice-daily', assignedKidId: 'k1', parentId: 'p1', status: 'active', createdAt: 2, categoryId: 'cat-2', reminderTime: '11:00' },
    ];
    const completions: any[] = [
      { id: 'c1', taskId: 't1', kidId: 'k1', completedAt: 1, dateString: '2026-06-03' },
      { id: 'c2', taskId: 't2', kidId: 'k1', completedAt: 1, dateString: '2026-06-03', count: 1 },
    ];

    const { result } = renderHook(() => useKidProgress({
      tasks,
      completions,
      profileUid: 'k1',
      today: '2026-06-03',
      selectedCategoryId: 'cat-1',
      sortBy: 'time',
    }));

    expect(result.current.filteredTasks.map((task) => task.id)).toEqual(['t1']);
    expect(result.current.totalSlots).toBe(3);
    expect(result.current.progressPercent).toBeCloseTo((2 / 3) * 100);
  });

  it('calculates streak from historical completions', async () => {
    vi.mocked(tasksClientService.getCompletionsForDateRange).mockResolvedValue([
      { id: 'c0', taskId: 't1', kidId: 'k1', completedAt: 1, dateString: '2026-06-02' },
      { id: 'c1', taskId: 't1', kidId: 'k1', completedAt: 1, dateString: '2026-06-01' },
    ] as any);

    const tasks: any[] = [
      { id: 't1', title: 'A', frequency: 'daily', assignedKidId: 'k1', parentId: 'p1', status: 'active', createdAt: 1 },
    ];
    const completions: any[] = [
      { id: 'c2', taskId: 't1', kidId: 'k1', completedAt: 1, dateString: '2026-06-03' },
    ];

    const { result } = renderHook(() => useKidProgress({
      tasks,
      completions,
      profileUid: 'k1',
      today: '2026-06-03',
      selectedCategoryId: null,
      sortBy: 'created',
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.streak).toBe(3);
  });
});
