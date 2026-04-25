// src/services/events.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventsClientService } from './events';

global.fetch = vi.fn();
// Mock localStorage to fix headers appending in fetchAPI
beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true
    });
});

describe('eventsClientService', () => {
  it('should call fetch to get events', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ title: 'Fetched Event' }]
    });

    const result = await eventsClientService.getEvents('parent_123');
    expect(global.fetch).toHaveBeenCalledWith('/api/parents/parent_123/events', expect.any(Object));
    expect(result[0].title).toBe('Fetched Event');
  });
});

