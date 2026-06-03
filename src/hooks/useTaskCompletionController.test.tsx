// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskCompletionController } from './useTaskCompletionController';

vi.mock('../services/tasks', () => ({
  tasksClientService: {
    completeTask: vi.fn(),
    uncompleteTask: vi.fn(),
    skipTask: vi.fn(),
  },
}));

import { tasksClientService } from '../services/tasks';

describe('useTaskCompletionController', () => {
  const profile: any = {
    uid: 'kid-1',
    parentId: 'parent-1',
    xp: 10,
  };

  const baseTask: any = {
    id: 'task-1',
    title: 'Brush teeth',
    difficulty: 'easy',
    frequency: 'daily',
    assignedKidId: 'kid-1',
    parentId: 'parent-1',
    status: 'active',
    createdAt: 1,
    starValue: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes a task without follow-up questions and updates local state', async () => {
    vi.mocked(tasksClientService.completeTask).mockResolvedValue({
      id: 'task-1_2026-06-03_1',
      approvalStatus: 'approved',
      created: true,
    });

    const onProfileUpdate = vi.fn();
    const { result } = renderHook(() => useTaskCompletionController({
      profile,
      tasks: [baseTask],
      today: '2026-06-03',
      onProfileUpdate,
    }));

    await act(async () => {
      await result.current.toggleTask('task-1', false, undefined, () => false);
    });

    await waitFor(() => expect(result.current.isCompleted('task-1')).toBe(true));
    expect(result.current.localXp).toBeGreaterThan(profile.xp);
    expect(onProfileUpdate).toHaveBeenCalled();
  });

  it('opens confirmation state when follow-up questions are required', async () => {
    const taskWithQuestions = {
      ...baseTask,
      completionQuestions: ['Did you wipe the sink?'],
      completionQuestionsKidId: 'kid-1',
    };

    const { result } = renderHook(() => useTaskCompletionController({
      profile,
      tasks: [taskWithQuestions],
      today: '2026-06-03',
      onProfileUpdate: vi.fn(),
    }));

    await act(async () => {
      await result.current.toggleTask('task-1', false, undefined, () => false);
    });

    expect(result.current.confirmTask).toMatchObject({
      taskId: 'task-1',
      taskTitle: 'Brush teeth',
      questions: ['Did you wipe the sink?'],
    });
    expect(tasksClientService.completeTask).not.toHaveBeenCalled();
  });
});
