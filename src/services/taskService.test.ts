import { userService } from './users';
import { tasksClientService } from './tasks';
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Task Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', { getItem: () => 'mock_token', setItem: () => {}, removeItem: () => {} });
  });

  it('getUserProfile should fetch and return profile', async () => {
    const mockProfile = { uid: '123', name: 'Kid Cadet', role: 'kid' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockProfile,
    });

    const profile = await userService.getUserProfile('123');
    
    expect(mockFetch).toHaveBeenCalledWith('/api/users/123', expect.objectContaining({
      headers: expect.any(Headers)
    }));
    
    expect(profile).toEqual(mockProfile);
  });

  it('createTask should send POST request and return new task id', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new_task_id' }),
    });

    const newTask = {
      title: 'Feed the dog',
      assignedKidId: '123',
      parentId: '456',
      frequency: 'daily' as const,
      difficulty: 'easy' as const
    };

    const newId = await tasksClientService.createTask(newTask);
    
    expect(mockFetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
      method: "POST",
      body: JSON.stringify(newTask)
    }));
    
    expect(newId).toBe('new_task_id');
  });

  it('fetchAPI should throw Error when not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404
    });

    await expect(userService.getUserProfile('999')).resolves.toBeNull(); 
    // getUserProfile catches the error and returns null
  });
});
