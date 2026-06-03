// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHomeworkController } from './useHomeworkController';

vi.mock('../services/homework', () => ({
  homeworkClientService: {
    getHomework: vi.fn(),
    updateHomework: vi.fn(),
    deleteHomework: vi.fn(),
    createHomework: vi.fn(),
  },
}));

import { homeworkClientService } from '../services/homework';

describe('useHomeworkController', () => {
  const kids: any[] = [
    { uid: 'k1', name: 'Kid One' },
    { uid: 'k2', name: 'Kid Two' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeworkClientService.getHomework).mockResolvedValue([
      {
        id: 'h1',
        parentId: 'p1',
        title: 'Math sheet',
        subject: 'Math',
        dueDate: '2026-06-03',
        assignedToId: 'k1',
        status: 'pending',
        color: '#fff',
        createdAt: 1,
      },
      {
        id: 'h2',
        parentId: 'p1',
        title: 'Reading',
        subject: 'ELA',
        dueDate: '2026-06-03',
        assignedToId: 'k2',
        status: 'done',
        color: '#fff',
        createdAt: 1,
      },
    ] as any);
    vi.mocked(homeworkClientService.updateHomework).mockResolvedValue({ success: true } as any);
    vi.mocked(homeworkClientService.deleteHomework).mockResolvedValue({ success: true } as any);
    vi.mocked(homeworkClientService.createHomework).mockResolvedValue({} as any);
  });

  it('filters homework for the active kid and splits pending/completed state', async () => {
    const { result } = renderHook(() => useHomeworkController({
      parentId: 'p1',
      kids,
      userRole: 'kid',
      currentUserId: 'k1',
    }));

    await waitFor(() => expect(result.current.visibleHomework).toHaveLength(1));
    expect(result.current.pendingHomework.map((item) => item.id)).toEqual(['h1']);
    expect(result.current.completedHomework).toHaveLength(0);
  });

  it('opens proof prompt instead of updating immediately when questions are required', async () => {
    vi.mocked(homeworkClientService.getHomework).mockResolvedValue([
      {
        id: 'h1',
        parentId: 'p1',
        title: 'Math sheet',
        subject: 'Math',
        dueDate: '2026-06-03',
        assignedToId: 'k1',
        status: 'pending',
        color: '#fff',
        createdAt: 1,
        completionQuestions: ['Show your work?'],
        completionQuestionsKidId: 'k1',
      },
    ] as any);

    const { result } = renderHook(() => useHomeworkController({
      parentId: 'p1',
      kids,
      userRole: 'kid',
      currentUserId: 'k1',
    }));

    await waitFor(() => expect(result.current.visibleHomework).toHaveLength(1));

    await act(async () => {
      await result.current.handleHomeworkToggle(result.current.visibleHomework[0]);
    });

    expect(result.current.proofPrompt).toMatchObject({
      item: { id: 'h1' },
      questions: ['Show your work?'],
    });
    expect(homeworkClientService.updateHomework).not.toHaveBeenCalled();
  });

  it('updates local homework state from the patch response without refetching', async () => {
    vi.mocked(homeworkClientService.updateHomework).mockResolvedValue({
      success: true,
      homework: {
        id: 'h1',
        parentId: 'p1',
        title: 'Math sheet',
        subject: 'Math',
        dueDate: '2026-06-03',
        assignedToId: 'k1',
        status: 'done',
        color: '#fff',
        createdAt: 1,
        completionResponse: 'Finished pages 1-2',
      },
    } as any);

    const { result } = renderHook(() => useHomeworkController({
      parentId: 'p1',
      kids,
      userRole: 'kid',
      currentUserId: 'k1',
    }));

    await waitFor(() => expect(result.current.visibleHomework).toHaveLength(1));
    const initialLoadCalls = vi.mocked(homeworkClientService.getHomework).mock.calls.length;

    await act(async () => {
      await result.current.updateHomeworkStatus(result.current.visibleHomework[0], 'done', 'Finished pages 1-2');
    });

    expect(result.current.completedHomework.map((item) => item.id)).toEqual(['h1']);
    expect(result.current.pendingHomework).toHaveLength(0);
    expect(result.current.visibleHomework[0].completionResponse).toBe('Finished pages 1-2');
    expect(vi.mocked(homeworkClientService.getHomework).mock.calls.length).toBe(initialLoadCalls);
  });
});
