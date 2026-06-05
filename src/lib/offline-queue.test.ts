// src/lib/offline-queue.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pushOfflineAction, getOfflineQueue, clearOfflineQueue, popOfflineAction, OfflineAction } from './offline-queue';

describe('offline-queue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const mockAction: Omit<OfflineAction, 'id' | 'timestamp'> = {
    type: 'TOGGLE',
    entity: 'list_item',
    endpoint: '/lists/items/1/toggle',
    method: 'POST',
    body: JSON.stringify({ completed: true }),
    description: 'Toggle item'
  };

  it('stores and retrieves an offline action', () => {
    pushOfflineAction(mockAction);
    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].description).toBe('Toggle item');
    expect(queue[0].id).toBeDefined();
    expect(queue[0].timestamp).toBeDefined();
  });

  it('pops an action from the queue', () => {
    pushOfflineAction(mockAction);
    pushOfflineAction({ ...mockAction, description: 'Second action' });
    
    const action = popOfflineAction();
    expect(action?.description).toBe('Toggle item');
    
    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].description).toBe('Second action');
  });

  it('returns undefined when popping from an empty queue', () => {
    const action = popOfflineAction();
    expect(action).toBeUndefined();
  });

  it('clears the offline queue', () => {
    pushOfflineAction(mockAction);
    clearOfflineQueue();
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it('handles corrupted JSON in storage', () => {
    localStorage.setItem('kidtasker_offline_queue', 'invalid json');
    
    // Silence console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const queue = getOfflineQueue();
    expect(queue).toEqual([]);
    expect(localStorage.getItem('kidtasker_offline_queue')).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('returns empty array if nothing in storage', () => {
    expect(getOfflineQueue()).toEqual([]);
  });
});
