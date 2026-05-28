import { CalendarEvent } from '../types';
import { fetchAPI } from './http';

export const eventsClientService = {
  getEvents: async (parentId: string): Promise<CalendarEvent[]> => {
    return fetchAPI(`/parents/${parentId}/events`);
  },

  createEvent: async (event: Omit<CalendarEvent, 'id'>): Promise<{ success: boolean; ids: string[] }> => {
    return fetchAPI('/events', { method: 'POST', body: JSON.stringify(event) });
  },

  updateEvent: async (id: string, data: Partial<CalendarEvent>, scope: 'one' | 'future' = 'one'): Promise<{ success: boolean }> => {
    return fetchAPI(`/events/${id}?scope=${scope}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteEvent: async (id: string, scope: 'one' | 'future' = 'one'): Promise<{ success: boolean }> => {
    return fetchAPI(`/events/${id}?scope=${scope}`, { method: 'DELETE' });
  },

  addAttendee: async (eventId: string, userId: string): Promise<{ success: boolean }> => {
    return fetchAPI(`/events/${eventId}/attendees`, { method: 'POST', body: JSON.stringify({ userId }) });
  },

  updateRsvp: async (eventId: string, userId: string, rsvp: string): Promise<{ success: boolean }> => {
    return fetchAPI(`/events/${eventId}/attendees/${userId}`, { method: 'PATCH', body: JSON.stringify({ rsvp }) });
  },

  removeAttendee: async (eventId: string, userId: string): Promise<{ success: boolean }> => {
    return fetchAPI(`/events/${eventId}/attendees/${userId}`, { method: 'DELETE' });
  },
};
