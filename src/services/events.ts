import { CalendarEvent } from '../types';
import { fetchAPI } from './http';
import { clientLogger } from './clientLogger';

const EVENTS_TTL_MS = 10_000;
const eventsCache = new Map<string, { value: CalendarEvent[]; expiresAt: number }>();
const eventsInflight = new Map<string, Promise<CalendarEvent[]>>();

export const eventsClientService = {
  getEvents: async (parentId: string): Promise<CalendarEvent[]> => {
    const cached = eventsCache.get(parentId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const inflight = eventsInflight.get(parentId);
    if (inflight) return inflight;
    const req = fetchAPI(`/parents/${parentId}/events`)
      .then((res) => {
        eventsCache.set(parentId, { value: res, expiresAt: Date.now() + EVENTS_TTL_MS });
        return res;
      })
      .finally(() => eventsInflight.delete(parentId));

    // Safety timeout to ensure inflight promise doesn't hang the UI forever
    // fetchAPI has its own 15s timeout, so this is just extra defense
    const safetyTimeout = setTimeout(() => {
      if (eventsInflight.get(parentId) === req) {
        clientLogger.warn('events_inflight_safety_timeout_triggered', { parentId });
        eventsInflight.delete(parentId);
      }
    }, 20000);
    
    req.finally(() => clearTimeout(safetyTimeout));

    eventsInflight.set(parentId, req);
    return req;
  },

  createEvent: async (event: Omit<CalendarEvent, 'id'>): Promise<{ success: boolean; ids: string[] }> => {
    const res = await fetchAPI('/events', { method: 'POST', body: JSON.stringify(event) });
    eventsCache.delete(event.parentId);
    return res;
  },

  updateEvent: async (id: string, data: Partial<CalendarEvent>, scope: 'one' | 'future' = 'one'): Promise<{ success: boolean }> => {
    const res = await fetchAPI(`/events/${id}?scope=${scope}`, { method: 'PUT', body: JSON.stringify(data) });
    eventsCache.clear();
    return res;
  },

  deleteEvent: async (id: string, scope: 'one' | 'future' = 'one'): Promise<{ success: boolean }> => {
    const res = await fetchAPI(`/events/${id}?scope=${scope}`, { method: 'DELETE' });
    eventsCache.clear();
    return res;
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
