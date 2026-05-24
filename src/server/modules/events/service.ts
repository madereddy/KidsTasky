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
  },

  updateEvent: (id: string, data: Partial<CalendarEvent>) => {
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CalendarEvent | undefined;
    if (!existing) throw new Error('Event not found');
    db.prepare(`
      UPDATE events SET title = ?, description = ?, startTime = ?, endTime = ?, assignedToId = ?, color = ?
      WHERE id = ?
    `).run(
      data.title ?? existing.title,
      data.description ?? existing.description,
      data.startTime ?? existing.startTime,
      data.endTime ?? existing.endTime,
      data.assignedToId ?? existing.assignedToId,
      data.color ?? existing.color,
      id
    );
  },

  deleteEvent: (id: string) => {
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  },

  setExternalId: (id: string, externalId: string, source: string) => {
    db.prepare('UPDATE events SET externalId = ?, source = ? WHERE id = ?').run(externalId, source, id);
  },
};
