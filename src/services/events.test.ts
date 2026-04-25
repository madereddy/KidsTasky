// src/services/events.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { eventsClientService } from './events';

global.fetch = vi.fn();

describe('eventsClientService', () => {
  it('should call fetch to get events', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ title: 'Fetched Event' }]
    });

    const result = await eventsClientService.getEvents('parent_123');
    expect(global.fetch).toHaveBeenCalledWith('/api/parents/parent_123/events');
    expect(result[0].title).toBe('Fetched Event');
  });
});
