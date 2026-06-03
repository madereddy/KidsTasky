// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homeworkClientService } from './homework';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Homework Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', { getItem: () => 'mock_token', setItem: () => {}, removeItem: () => {} });
  });

  it('createHomework should return the created homework payload', async () => {
    const created = {
      id: 'hw1',
      parentId: 'p1',
      title: 'Math',
      subject: 'Math',
      dueDate: '2026-06-03',
      status: 'pending',
      color: '#6366f1',
      createdAt: 1,
      completionQuestions: ['Show work'],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => created,
    });

    const result = await homeworkClientService.createHomework({
      parentId: 'p1',
      title: 'Math',
      subject: 'Math',
      dueDate: '2026-06-03',
      status: 'pending',
      color: '#6366f1',
      completionQuestions: ['Show work'],
    } as any);

    expect(result).toEqual(created);
  });

  it('updateHomework should preserve the updated homework contract payload', async () => {
    const updated = {
      id: 'hw1',
      parentId: 'p1',
      title: 'Math',
      subject: 'Math',
      dueDate: '2026-06-04',
      status: 'pending',
      color: '#6366f1',
      createdAt: 1,
      completionQuestions: [],
      completionResponse: 'Finished pages 10-20',
      recurrence: 'weekdays',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, homework: updated }),
    });

    const result = await homeworkClientService.updateHomework('hw1', {
      status: 'done',
      completionResponse: 'Finished pages 10-20',
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/homework/hw1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ status: 'done', completionResponse: 'Finished pages 10-20' }),
    }));
    expect(result).toEqual({ success: true, homework: updated });
  });
});
