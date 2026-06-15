// src/server/modules/events/service.ts
import { addDays, addWeeks, addMonths, addYears, parseISO, format } from 'date-fns';
import { db } from '../../db.js';
import { CalendarEvent, EventAttendee, RsvpStatus } from '../../../types.js';

import { randomUUID } from 'crypto';

function generateId() {
  return 'evt_' + randomUUID();
}

function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

const INSERT_EVENT = `
  INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color,
    isAllDay, masterId, recurrence, recurrenceEnd, isCountdown, reminderMinutes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const eventsService = {
  createEvent: (event: Omit<CalendarEvent, 'id'>) => {
    const id = generateId();
    db.prepare(INSERT_EVENT).run(
      id,
      event.parentId,
      event.title,
      event.description || null,
      event.startTime,
      event.endTime,
      event.assignedToId || null,
      event.color,
      event.isAllDay ?? 0,
      event.masterId || null,
      event.recurrence || 'none',
      event.recurrenceEnd || null,
      event.isCountdown ?? 0,
      event.reminderMinutes ?? null
    );
    return id;
  },

  createRecurringEvents: (master: Omit<CalendarEvent, 'id'>, recurrence: string, recurrenceEnd: string): string[] => {
    const masterId = generateId();
    const ids: string[] = [];
    const endDate = parseISO(recurrenceEnd);
    endDate.setHours(23, 59, 59, 999);
    const duration = master.endTime - master.startTime;
    let cursor = new Date(master.startTime);
    const dayOfMonth = cursor.getDate();
    let yearCount = 0;

    while (cursor <= endDate) {
      const id = generateId();
      db.prepare(INSERT_EVENT).run(
        id,
        master.parentId,
        master.title,
        master.description || null,
        cursor.getTime(),
        cursor.getTime() + duration,
        master.assignedToId || null,
        master.color,
        master.isAllDay ?? 0,
        masterId,
        recurrence,
        recurrenceEnd,
        master.isCountdown ?? 0,
        master.reminderMinutes ?? null
      );
      ids.push(id);

      if (recurrence === 'daily') {
        cursor = addDays(cursor, 1);
      } else if (recurrence === 'weekly') {
        cursor = addWeeks(cursor, 1);
      } else if (recurrence === 'monthly') {
        const next = addMonths(cursor, 1);
        cursor = clampToMonth(next.getFullYear(), next.getMonth(), dayOfMonth);
        cursor.setHours(new Date(master.startTime).getHours(), new Date(master.startTime).getMinutes());
      } else if (recurrence === 'yearly') {
        yearCount++;
        if (yearCount >= 5) break;
        const next = addYears(cursor, 1);
        // Handle Feb 29 → Feb 28 in non-leap years
        if (next.getMonth() === 1 && dayOfMonth === 29 && next.getDate() !== 29) {
          next.setDate(28);
        }
        cursor = next;
      } else {
        break;
      }

      // Safety cap: daily/weekly limited to 1 year ahead
      if ((recurrence === 'daily' || recurrence === 'weekly') &&
          cursor.getTime() > master.startTime + 365 * 24 * 3600 * 1000) break;
    }
    return ids;
  },

  getEventsByParent: (parentId: string): CalendarEvent[] => {
    const events = db.prepare('SELECT * FROM events WHERE parentId = ? ORDER BY startTime ASC').all(parentId) as CalendarEvent[];
    const attendeeMap = new Map<string, EventAttendee[]>();
    const attendees = db.prepare(`
      SELECT ea.id, ea.eventId, ea.userId, ea.rsvp, u.name
      FROM event_attendees ea
      LEFT JOIN users u ON u.uid = ea.userId
      WHERE ea.eventId IN (SELECT id FROM events WHERE parentId = ?)
    `).all(parentId) as EventAttendee[];
    for (const attendee of attendees) {
      if (!attendeeMap.has(attendee.eventId)) attendeeMap.set(attendee.eventId, []);
      attendeeMap.get(attendee.eventId)!.push(attendee);
    }
    return events.map((event) => ({ ...event, attendees: attendeeMap.get(event.id) ?? [] }));
  },

  getEventsByParentWindowed: (parentId: string, fromMs: number, toMs: number): CalendarEvent[] => {
    const events = db.prepare(
      'SELECT * FROM events WHERE parentId = ? AND startTime >= ? AND startTime <= ? ORDER BY startTime ASC'
    ).all(parentId, fromMs, toMs) as CalendarEvent[];
    if (events.length === 0) return [];
    const attendees = db.prepare(`
      SELECT ea.id, ea.eventId, ea.userId, ea.rsvp, u.name
      FROM event_attendees ea
      LEFT JOIN users u ON u.uid = ea.userId
      WHERE ea.eventId IN (
        SELECT id FROM events WHERE parentId = ? AND startTime >= ? AND startTime <= ?
      )
    `).all(parentId, fromMs, toMs) as EventAttendee[];
    const attendeeMap = new Map<string, EventAttendee[]>();
    for (const attendee of attendees) {
      if (!attendeeMap.has(attendee.eventId)) attendeeMap.set(attendee.eventId, []);
      attendeeMap.get(attendee.eventId)!.push(attendee);
    }
    return events.map((event) => ({ ...event, attendees: attendeeMap.get(event.id) ?? [] }));
  },

  getEventById: (id: string): CalendarEvent | undefined => {
    return db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CalendarEvent | undefined;
  },

  updateEvent: (id: string, data: Partial<CalendarEvent>, scope: 'one' | 'future' = 'one') => {
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CalendarEvent | undefined;
    if (!existing) throw new Error('Event not found');

    const merged = {
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime ?? existing.endTime,
      assignedToId: data.assignedToId !== undefined ? data.assignedToId : existing.assignedToId,
      color: data.color ?? existing.color,
      isAllDay: data.isAllDay ?? existing.isAllDay,
      recurrence: data.recurrence ?? existing.recurrence,
      recurrenceEnd: data.recurrenceEnd ?? existing.recurrenceEnd,
      reminderMinutes: data.reminderMinutes !== undefined ? data.reminderMinutes : existing.reminderMinutes,
      isCountdown: data.isCountdown ?? existing.isCountdown,
    };

    if (scope === 'one' || !existing.masterId) {
      db.prepare(`UPDATE events SET title=?,description=?,startTime=?,endTime=?,assignedToId=?,color=?,isAllDay=?,recurrence=?,recurrenceEnd=?,reminderMinutes=?,isCountdown=? WHERE id=?`)
        .run(merged.title, merged.description, merged.startTime, merged.endTime, merged.assignedToId, merged.color, merged.isAllDay, merged.recurrence, merged.recurrenceEnd, merged.reminderMinutes, merged.isCountdown, id);
      return [id];
    }

    // scope === 'future': apply delta for time changes, literal for other fields
    const startDelta = (data.startTime !== undefined) ? data.startTime - existing.startTime : 0;
    const endDelta = (data.endTime !== undefined) ? data.endTime - existing.endTime : 0;

    const affectedIds = (db.prepare('SELECT id FROM events WHERE masterId=? AND startTime>=? ORDER BY startTime ASC')
      .all(existing.masterId, existing.startTime) as { id: string }[]).map(r => r.id);

    const stmt = db.prepare(`UPDATE events SET title=?,description=?,assignedToId=?,color=?,isAllDay=?,recurrence=?,recurrenceEnd=?,reminderMinutes=?,isCountdown=?,startTime=startTime+?,endTime=endTime+? WHERE id=?`);
    for (const aid of affectedIds) {
      stmt.run(merged.title, merged.description, merged.assignedToId, merged.color, merged.isAllDay, merged.recurrence, merged.recurrenceEnd, merged.reminderMinutes, merged.isCountdown, startDelta, endDelta, aid);
    }

    // Cap the predecessor's recurrenceEnd if this is not the first instance
    const predecessor = db.prepare('SELECT id FROM events WHERE masterId=? AND startTime<? ORDER BY startTime DESC LIMIT 1')
      .get(existing.masterId, existing.startTime) as { id: string } | undefined;
    if (predecessor) {
      const capDate = new Date(existing.startTime - 1);
      db.prepare("UPDATE events SET recurrenceEnd=? WHERE id=?").run(format(capDate, 'yyyy-MM-dd'), predecessor.id);
    } else {
      // Targeting first instance: re-UUID the surviving group
      const newMasterId = generateId();
      db.prepare('UPDATE events SET masterId=? WHERE masterId=? AND startTime>=?').run(newMasterId, existing.masterId, existing.startTime);
    }

    return affectedIds;
  },

  deleteEvent: (id: string, scope: 'one' | 'future' = 'one') => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CalendarEvent | undefined;
    if (!event) return [];

    if (scope === 'one' || !event.masterId) {
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
      return [id];
    }

    // scope === 'future'
    const affected = (db.prepare('SELECT id FROM events WHERE masterId=? AND startTime>=?')
      .all(event.masterId, event.startTime) as { id: string }[]).map(r => r.id);
    db.prepare('DELETE FROM events WHERE masterId=? AND startTime>=?').run(event.masterId, event.startTime);

    // Cap predecessor
    const predecessor = db.prepare('SELECT id FROM events WHERE masterId=? AND startTime<? ORDER BY startTime DESC LIMIT 1')
      .get(event.masterId, event.startTime) as { id: string } | undefined;
    if (predecessor) {
      const capDate = format(new Date(event.startTime - 1), 'yyyy-MM-dd');
      db.prepare("UPDATE events SET recurrenceEnd=? WHERE id=?").run(capDate, predecessor.id);
    }
    return affected;
  },

  setExternalId: (id: string, externalId: string, source: string) => {
    db.prepare('UPDATE events SET externalId = ?, source = ? WHERE id = ?').run(externalId, source, id);
  },

  addAttendee: (eventId: string, userId: string) => {
    const id = 'att_' + randomUUID();
    db.prepare('INSERT OR IGNORE INTO event_attendees (id, eventId, userId) VALUES (?, ?, ?)').run(id, eventId, userId);
  },

  updateRsvp: (eventId: string, userId: string, rsvp: RsvpStatus): boolean => {
    const result = db.prepare('UPDATE event_attendees SET rsvp = ? WHERE eventId = ? AND userId = ?').run(rsvp, eventId, userId);
    return result.changes > 0;
  },

  removeAttendee: (eventId: string, userId: string) => {
    db.prepare('DELETE FROM event_attendees WHERE eventId = ? AND userId = ?').run(eventId, userId);
  },
};

export function assertFamilyMember(targetUserId: string, parentId: string): boolean {
  const row = db.prepare(
    'SELECT uid FROM users WHERE uid = ? AND (uid = ? OR parentId = ?)'
  ).get(targetUserId, parentId, parentId) as { uid: string } | undefined;
  return Boolean(row);
}
