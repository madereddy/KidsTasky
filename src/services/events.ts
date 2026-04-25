// src/services/events.ts
import { CalendarEvent } from '../types';

import { fetchAPI } from './http';

export const eventsClientService = {
  getEvents: async (parentId: string): Promise<CalendarEvent[]> => {
    return fetchAPI(`/parents/${parentId}/events`);
  },
  
  createEvent: async (event: Omit<CalendarEvent, 'id'>): Promise<{ success: boolean; id: string }> => {
    return fetchAPI('/events', {
      method: 'POST',
      body: JSON.stringify(event)
    });
  }
};
