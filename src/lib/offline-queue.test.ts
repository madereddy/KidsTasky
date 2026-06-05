// src/lib/offline-queue.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pushOfflineAction, getOfflineQueue, clearOfflineQueue } from './offline-queue';

describe('offline-queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves an offline action', () => {
    const action = {
      type: 'TOGGLE',
      entity: 'list_item',
      endpoint: '/lists/items/1/toggle',
      method: 'POST',
      body: JSON.stringify({ completed: true }),
      description: 'Toggle item'
    };
    pushOfflineAction(action as any);
    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].description).toBe('Toggle item');
  });
});
