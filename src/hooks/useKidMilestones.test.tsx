// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKidMilestones } from './useKidMilestones';

vi.mock('../services/users', () => ({
  userService: {
    addBadge: vi.fn(),
  },
}));

vi.mock('../services/tasks', () => ({
  tasksClientService: {
    getCompletionsForDateRange: vi.fn(),
  },
}));

import { userService } from '../services/users';
import { tasksClientService } from '../services/tasks';

describe('useKidMilestones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksClientService.getCompletionsForDateRange).mockResolvedValue([]);
  });

  it('awards first mission when the kid has their first completion', async () => {
    const { result } = renderHook(() =>
      useKidMilestones({
        profile: { uid: 'k1', role: 'kid', name: 'Kid', email: 'kid@test.com', badges: [] },
        tasks: [],
        completions: [
          {
            id: 'c1',
            taskId: 't1',
            kidId: 'k1',
            dateString: '2026-06-03',
            completedAt: { seconds: 1 },
          },
        ],
        localXp: 0,
        streak: 0,
        loading: false,
        today: '2026-06-03',
        onProfileUpdate: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.unlockedBadge?.id).toBe('first_mission'));
    expect(userService.addBadge).toHaveBeenCalledWith('k1', 'first_mission');
  });

  it('awards hard master when hard-task history reaches the threshold', async () => {
    vi.mocked(tasksClientService.getCompletionsForDateRange).mockResolvedValue([
      { id: 'h1', taskId: 'hard-1', kidId: 'k1', dateString: '2026-06-01', completedAt: { seconds: 1 } },
      { id: 'h2', taskId: 'hard-1', kidId: 'k1', dateString: '2026-06-02', completedAt: { seconds: 2 } },
      { id: 'h3', taskId: 'hard-1', kidId: 'k1', dateString: '2026-06-03', completedAt: { seconds: 3 } },
      { id: 'h4', taskId: 'hard-2', kidId: 'k1', dateString: '2026-06-04', completedAt: { seconds: 4 } },
      { id: 'h5', taskId: 'hard-2', kidId: 'k1', dateString: '2026-06-05', completedAt: { seconds: 5 } },
    ] as any);

    const { result } = renderHook(() =>
      useKidMilestones({
        profile: { uid: 'k1', role: 'kid', name: 'Kid', email: 'kid@test.com', badges: [] },
        tasks: [
          { id: 'hard-1', title: 'Clean Room', difficulty: 'hard' as const, frequency: 'daily' as const, assignedKidId: 'k1', parentId: 'p1', status: 'active' as const, createdAt: Date.now() },
          { id: 'hard-2', title: 'Yard Work', difficulty: 'hard' as const, frequency: 'daily' as const, assignedKidId: 'k1', parentId: 'p1', status: 'active' as const, createdAt: Date.now() },
        ],
        completions: [],
        localXp: 0,
        streak: 0,
        loading: false,
        today: '2026-06-03',
        onProfileUpdate: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.unlockedBadge?.id).toBe('hard_master'));
    expect(userService.addBadge).toHaveBeenCalledWith('k1', 'hard_master');
  });
});
