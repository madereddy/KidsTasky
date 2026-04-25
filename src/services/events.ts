// src/services/events.ts
import { CalendarEvent } from '../types';

export const eventsClientService = {
  getEvents: async (parentId: string): Promise<CalendarEvent[]> => {
    const res = await fetch(`/api/parents/${parentId}/events`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
  },
  
  createEvent: async (event: Omit<CalendarEvent, 'id'>): Promise<{ success: boolean; id: string }> => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!res.ok) throw new Error('Failed to create event');
    return res.json();
  }
};
