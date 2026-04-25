// src/server/modules/events/service.ts
import { db } from '../../db.js';
import { CalendarEvent } from '../../../types.js';

export const eventsService = {
  createEvent: (event: Omit<CalendarEvent, 'id'>) => {
    const id = 'evt_' + Math.random().toString(36).substring(2, 9);
    const stmt = db.prepare(`
      INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, event.parentId, event.title, event.description || null, event.startTime, event.endTime, event.assignedToId || null, event.color);
    return id;
  },
  
  getEventsByParent: (parentId: string): CalendarEvent[] => {
    return db.prepare('SELECT * FROM events WHERE parentId = ? ORDER BY startTime ASC').all(parentId) as CalendarEvent[];
  },

  getEventById: (id: string): CalendarEvent | undefined => {
    return db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CalendarEvent | undefined;
  }
};
