# Group A — Calendar Core Implementation Plan

## Plan Status (2026-05-27)
- COMPLETED


## Status Update (2026-05-27)

- Completed: recurring events, all-day rendering, countdown/reminder event fields, event detail modal, scoped update/delete APIs.
- Completed: server-side edit lock enforcement on POST/PUT/DELETE /events (via enforceEditUnlocked).
- Completed: calendar now listens to socket stale-data and refetches events for faster multi-device convergence.
- Remaining: broader UX polish and optional parity enhancements (no known blocker for family use).


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recurring events, event edit/delete modal, and all-day events to the KidsTasky calendar.

**Architecture:** Recurring events expand upfront into individual DB rows sharing a `masterId`. A new `EventDetailModal` component handles view/edit/delete for any event. All-day events use an `isAllDay` flag and render in a pinned top strip in week/day views. Six new columns land in a single migration; the existing `getEventsByParent` query works unchanged.

**Tech Stack:** Express 5, better-sqlite3, React 19, Vitest + supertest, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-26-skylight-parity-design.md` § Group A

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/server/migrations/027_add_recurring_allday_countdown.sql` | Create | Schema: 6 new event columns + index |
| `src/types.ts` | Modify | Add new fields to `CalendarEvent` |
| `src/server/modules/events/service.ts` | Modify | Explicit-column createEvent, createRecurringEvents, scoped updateEvent/deleteEvent |
| `src/server/modules/events/routes.ts` | Modify | Allowed-field extraction, scope param, bulk Google sync |
| `src/server/modules/events/api.test.ts` | Modify | Tests for recurring CRUD, all-day, scoped delete/update |
| `src/services/events.ts` | Modify | Pass new fields + scope to API |
| `src/components/calendar/EventDetailModal.tsx` | Create | View/edit/delete modal for any event |
| `src/components/calendar/AddEventModal.tsx` | Modify | All-day toggle, recurrence picker, end date, reminder picker |
| `src/components/calendar/CalendarMonthView.tsx` | Modify | Pass onEventClick to event chips |
| `src/components/calendar/CalendarWeekView.tsx` | Modify | All-day top strip + onEventClick |
| `src/components/calendar/CalendarDayView.tsx` | Modify | All-day top strip + onEventClick |
| `src/components/calendar/AgendaView.tsx` | Modify | onEventClick on event rows |
| `src/components/calendar/CalendarView.tsx` | Modify | selectedEvent state + render EventDetailModal |

---

### Task 1: Schema migration

**Files:**
- Create: `src/server/migrations/027_add_recurring_allday_countdown.sql`

- [ ] **Step 1: Create migration file**

```sql
ALTER TABLE events ADD COLUMN isAllDay INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN masterId TEXT;
ALTER TABLE events ADD COLUMN recurrence TEXT DEFAULT 'none';
ALTER TABLE events ADD COLUMN recurrenceEnd TEXT;
ALTER TABLE events ADD COLUMN isCountdown INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN reminderMinutes INTEGER;

CREATE INDEX IF NOT EXISTS idx_events_parent_start ON events(parentId, startTime);

UPDATE schema_version SET version = 27;
```

- [ ] **Step 2: Verify migration runs clean**

Run: `npx vitest run src/server/modules/events/api.test.ts`
Expected: PASS (migration runner catches duplicate column errors gracefully if re-run)

- [ ] **Step 3: Commit**

```
git commit -m "feat: add recurring/allday/countdown columns to events (migration 027)"
```

---

### Task 2: Update CalendarEvent type

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new fields to CalendarEvent interface**

```typescript
export interface CalendarEvent {
  id: string;
  parentId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  assignedToId?: string;
  color: string;
  externalId?: string;
  source?: string;
  sourceCalendarId?: string;
  // New fields
  isAllDay?: number;        // 0 or 1
  masterId?: string;        // links recurring instances
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEnd?: string;   // YYYY-MM-DD
  isCountdown?: number;     // 0 or 1
  reminderMinutes?: number | null;
}
```

- [ ] **Step 2: Run type-check**

Run: `npm run lint`
Expected: PASS (no new errors — new fields are all optional)

- [ ] **Step 3: Commit**

```
git commit -m "feat: add recurring/allday/countdown/reminder fields to CalendarEvent type"
```

---

### Task 3: Update eventsService — createEvent + createRecurringEvents

**Files:**
- Modify: `src/server/modules/events/service.ts`
- Modify: `src/server/modules/events/api.test.ts`

- [ ] **Step 1: Write failing tests for new createEvent + createRecurringEvents**

Add to `src/server/modules/events/api.test.ts`:

```typescript
it('should create an all-day event', async () => {
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      parentId,
      title: 'Holiday',
      startTime: new Date('2026-06-01').getTime(),
      endTime: new Date('2026-06-01T23:59:59').getTime(),
      color: '#ff0000',
      isAllDay: 1
    });
  expect(res.status).toBe(200);
  const events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
  expect(events.body[0].isAllDay).toBe(1);
});

it('should create a weekly recurring event and expand to multiple rows', async () => {
  const startTime = new Date('2026-06-01T09:00:00').getTime();
  const endTime = new Date('2026-06-01T10:00:00').getTime();
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      parentId,
      title: 'Weekly Standup',
      startTime,
      endTime,
      color: '#3b82f6',
      recurrence: 'weekly',
      recurrenceEnd: '2026-06-29'
    });
  expect(res.status).toBe(200);
  const events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
  // June 1, 8, 15, 22, 29 = 5 Mondays
  expect(events.body.length).toBe(5);
  expect(events.body.every((e: any) => e.masterId === events.body[0].masterId)).toBe(true);
});

it('should clamp monthly recurrence on day 31', async () => {
  const startTime = new Date('2026-01-31T09:00:00').getTime();
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      parentId,
      title: 'Monthly end',
      startTime,
      endTime: startTime + 3600000,
      color: '#ff0000',
      recurrence: 'monthly',
      recurrenceEnd: '2026-04-30'
    });
  expect(res.status).toBe(200);
  const events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
  const dates = events.body.map((e: any) => new Date(e.startTime).getDate());
  // Jan 31, Feb 28, Mar 31, Apr 30
  expect(dates).toContain(28); // Feb clamped
  expect(dates).toContain(30); // Apr clamped
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/server/modules/events/api.test.ts`
Expected: FAIL — isAllDay not persisted, recurrence not expanded

- [ ] **Step 3: Rewrite createEvent with explicit columns + add createRecurringEvents**

Replace `eventsService.createEvent` and add `createRecurringEvents` in `src/server/modules/events/service.ts`:

```typescript
import { addDays, addWeeks, addMonths, addYears, parseISO, format } from 'date-fns';
import { db } from '../../db.js';
import { CalendarEvent } from '../../../types.js';

function generateId() {
  return 'evt_' + Math.random().toString(36).substring(2, 9);
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
    return db.prepare('SELECT * FROM events WHERE parentId = ? ORDER BY startTime ASC').all(parentId) as CalendarEvent[];
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
};
```

- [ ] **Step 4: Install date-fns if not present**

Run: `npm list date-fns`
If not installed: `npm install date-fns`

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/server/modules/events/api.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```
git commit -m "feat: explicit-column createEvent, createRecurringEvents with monthly clamp + leap-year handling"
```

---

### Task 4: Update events routes — scope param + recurring dispatch

**Files:**
- Modify: `src/server/modules/events/routes.ts`
- Modify: `src/server/modules/events/api.test.ts`

- [ ] **Step 1: Write failing tests for scope param**

Add to `api.test.ts`:

```typescript
it('should delete a single recurring instance with scope=one', async () => {
  // Create weekly recurring (5 instances)
  await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ parentId, title: 'Weekly', startTime: new Date('2026-06-01T09:00:00').getTime(), endTime: new Date('2026-06-01T10:00:00').getTime(), color: '#000', recurrence: 'weekly', recurrenceEnd: '2026-06-29' });
  let events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
  expect(events.body.length).toBe(5);
  const secondId = events.body[1].id;

  await request(app).delete(`/api/events/${secondId}?scope=one`).set('Authorization', `Bearer ${token}`);
  events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
  expect(events.body.length).toBe(4);
});

it('should delete this-and-future recurring instances', async () => {
  await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ parentId, title: 'Weekly', startTime: new Date('2026-06-01T09:00:00').getTime(), endTime: new Date('2026-06-01T10:00:00').getTime(), color: '#000', recurrence: 'weekly', recurrenceEnd: '2026-06-29' });
  let events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
  const thirdId = events.body[2].id; // June 15

  await request(app).delete(`/api/events/${thirdId}?scope=future`).set('Authorization', `Bearer ${token}`);
  events = await request(app).get(`/api/parents/${parentId}/events`).set('Authorization', `Bearer ${token}`);
  expect(events.body.length).toBe(2); // June 1 + 8 remain
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/server/modules/events/api.test.ts`
Expected: FAIL — routes don't pass scope yet

- [ ] **Step 3: Update routes**

Replace `src/server/modules/events/routes.ts`:

```typescript
import { Router } from 'express';
import { eventsService } from './service.js';
import { syncService } from '../sync/service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const eventsRouter = Router();

const ALLOWED_CREATE_FIELDS = [
  'title', 'description', 'startTime', 'endTime', 'assignedToId', 'color',
  'isAllDay', 'recurrence', 'recurrenceEnd', 'isCountdown', 'reminderMinutes'
] as const;

eventsRouter.post('/events', authenticateUser, async (req, res) => {
  try {
    const parentId = getParentId(req);
    const allowed: Record<string, any> = {};
    for (const field of ALLOWED_CREATE_FIELDS) {
      if (req.body[field] !== undefined) allowed[field] = req.body[field];
    }
    const eventData = { ...allowed, parentId };

    let ids: string[];
    if (allowed.recurrence && allowed.recurrence !== 'none' && allowed.recurrenceEnd) {
      ids = eventsService.createRecurringEvents(eventData as any, allowed.recurrence, allowed.recurrenceEnd);
    } else {
      ids = [eventsService.createEvent(eventData as any)];
    }

    res.json({ success: true, ids });

    // Google sync: push first event only (or all — push first is sufficient for display)
    const first = eventsService.getEventById(ids[0]);
    if (first) {
      const googleId = await syncService.pushEventToGoogle(first.parentId, first).catch(() => null);
      if (googleId) eventsService.setExternalId(ids[0], googleId, 'google');
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.get('/parents/:parentId/events', authenticateUser, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId as string) return res.status(403).json({ error: 'Forbidden' });
    res.json(eventsService.getEventsByParent(req.params.parentId as string));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.put('/events/:id', authenticateUser, async (req, res) => {
  try {
    const event = eventsService.getEventById(req.params.id as string);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const scope = (req.query.scope as string) === 'future' ? 'future' : 'one';
    const allowed: Record<string, any> = {};
    for (const field of ALLOWED_CREATE_FIELDS) {
      if (req.body[field] !== undefined) allowed[field] = req.body[field];
    }

    const affectedIds = eventsService.updateEvent(req.params.id as string, allowed, scope);
    res.json({ success: true });

    // Sync each affected event to Google
    for (const aid of affectedIds) {
      const updated = eventsService.getEventById(aid);
      if (!updated) continue;
      if (updated.externalId) {
        await syncService.updateEventInGoogle(updated.parentId, updated).catch(() => {});
      } else {
        const googleId = await syncService.pushEventToGoogle(updated.parentId, updated).catch(() => null);
        if (googleId) eventsService.setExternalId(aid, googleId, 'google');
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventsRouter.delete('/events/:id', authenticateUser, async (req, res) => {
  try {
    const event = eventsService.getEventById(req.params.id as string);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const scope = (req.query.scope as string) === 'future' ? 'future' : 'one';
    eventsService.deleteEvent(req.params.id as string, scope);
    res.json({ success: true });

    if (event.externalId) {
      await syncService.deleteEventFromGoogle(event.parentId, event.externalId).catch(() => {});
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 4: Run all events tests**

Run: `npx vitest run src/server/modules/events/`
Expected: PASS

- [ ] **Step 5: Commit**

```
git commit -m "feat: events routes — scope param, allowed-field extraction, bulk Google sync for future edits"
```

---

### Task 5: Update eventsClientService

**Files:**
- Modify: `src/services/events.ts`

- [ ] **Step 1: Add scope + new fields to client service**

Replace `src/services/events.ts`:

```typescript
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
  }
};
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```
git commit -m "feat: eventsClientService — scope param + new fields"
```

---

### Task 6: AddEventModal — all-day toggle, recurrence picker, reminder picker

**Files:**
- Modify: `src/components/calendar/AddEventModal.tsx`

- [ ] **Step 1: Add state + UI for new fields**

Add to the component state:
```typescript
const [isAllDay, setIsAllDay] = useState(false);
const [recurrence, setRecurrence] = useState<'none'|'daily'|'weekly'|'monthly'|'yearly'>('none');
const [recurrenceEnd, setRecurrenceEnd] = useState('');
const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
```

In `handleSubmit`, update `createEvent` call:
```typescript
await eventsClientService.createEvent({
  parentId,
  title: title.trim(),
  description: description.trim(),
  startTime: isAllDay ? new Date(date).setHours(0,0,0,0) : new Date(`${date}T${startTime}`).getTime(),
  endTime: isAllDay ? new Date(date).setHours(23,59,59,999) : (endMs > startMs ? endMs : startMs + 3600000),
  color,
  assignedToId: assignedToId || undefined,
  isAllDay: isAllDay ? 1 : 0,
  recurrence,
  recurrenceEnd: recurrence !== 'none' ? recurrenceEnd : undefined,
  reminderMinutes: reminderMinutes ?? undefined,
});
```

Add UI after the date picker:
```tsx
{/* All day toggle */}
<div className="flex items-center gap-2">
  <input type="checkbox" id="allday" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="rounded" />
  <label htmlFor="allday" className="text-xs font-semibold text-ui-secondary">All day</label>
</div>

{/* Hide time pickers when all-day */}
{!isAllDay && (
  <div className="grid grid-cols-2 gap-3">
    {/* existing start/end time inputs */}
  </div>
)}

{/* Recurrence */}
<div>
  <label className="block text-xs font-semibold text-ui-secondary mb-1">Repeat</label>
  <select value={recurrence} onChange={e => setRecurrence(e.target.value as any)}
    className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
    <option value="none">Does not repeat</option>
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
    <option value="yearly">Yearly</option>
  </select>
</div>

{recurrence !== 'none' && (
  <div>
    <label className="block text-xs font-semibold text-ui-secondary mb-1">End repeat</label>
    <input type="date" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)}
      className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
  </div>
)}

{/* Reminder */}
<div>
  <label className="block text-xs font-semibold text-ui-secondary mb-1">Remind me</label>
  <select value={reminderMinutes ?? ''} onChange={e => setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))}
    className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
    <option value="">No reminder</option>
    <option value="0">At time of event</option>
    <option value="5">5 minutes before</option>
    <option value="10">10 minutes before</option>
    <option value="15">15 minutes before</option>
    <option value="30">30 minutes before</option>
    <option value="60">1 hour before</option>
    <option value="1440">1 day before</option>
  </select>
</div>
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```
git commit -m "feat: AddEventModal — all-day toggle, recurrence picker, reminder picker"
```

---

### Task 7: EventDetailModal — new component

**Files:**
- Create: `src/components/calendar/EventDetailModal.tsx`

- [ ] **Step 1: Create EventDetailModal**

```tsx
import React, { useState } from 'react';
import { format } from 'date-fns';
import { X, Edit2, Trash2 } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { CalendarEvent, UserProfile } from '../../types';
import { cn } from '../../lib/utils';

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];
const REMINDER_LABELS: Record<number, string> = { 0: 'At time', 5: '5 min before', 10: '10 min before', 15: '15 min before', 30: '30 min before', 60: '1 hr before', 1440: '1 day before' };

interface Props {
  event: CalendarEvent;
  kids: UserProfile[];
  userRole: 'parent' | 'kid';
  onClose: () => void;
  onUpdated: () => void;
}

type DeleteScope = 'one' | 'future';

export function EventDetailModal({ event, kids, userRole, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [color, setColor] = useState(event.color);
  const [assignedToId, setAssignedToId] = useState(event.assignedToId || '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(event.reminderMinutes ?? null);
  const [isCountdown, setIsCountdown] = useState(Boolean(event.isCountdown));
  const [saving, setSaving] = useState(false);
  const [showDeleteScope, setShowDeleteScope] = useState(false);
  const [showEditScope, setShowEditScope] = useState(false);
  const isRecurring = Boolean(event.masterId);
  const isParent = userRole === 'parent';

  const handleSave = async (scope: 'one' | 'future' = 'one') => {
    setSaving(true);
    try {
      await eventsClientService.updateEvent(event.id, { title, description, color, assignedToId: assignedToId || undefined, reminderMinutes: reminderMinutes ?? undefined, isCountdown: isCountdown ? 1 : 0 }, scope);
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scope: DeleteScope) => {
    await eventsClientService.deleteEvent(event.id, scope);
    onUpdated();
    onClose();
  };

  const assignee = kids.find(k => k.uid === event.assignedToId);
  const recurrenceLabel = event.recurrence && event.recurrence !== 'none'
    ? `${event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}${event.recurrenceEnd ? ` until ${event.recurrenceEnd}` : ''}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderLeftColor: event.color, borderLeftWidth: 4 }}>
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 text-lg font-bold border-b border-ui-soft focus:outline-none mr-2" />
          ) : (
            <h2 className="text-lg font-bold">{event.title}</h2>
          )}
          <button onClick={onClose} className="p-2 hover:bg-ui-soft-2 rounded-full"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Date/time */}
          <div className="text-sm text-ui-secondary">
            {event.isAllDay
              ? format(new Date(event.startTime), 'EEEE, MMMM d, yyyy') + ' · All day'
              : `${format(new Date(event.startTime), 'EEE, MMM d · h:mm a')} – ${format(new Date(event.endTime), 'h:mm a')}`}
          </div>

          {recurrenceLabel && <div className="text-xs text-ui-muted bg-ui-soft px-2 py-1 rounded-lg inline-block">{recurrenceLabel}</div>}

          {editing ? (
            <>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Description" className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              <div className="flex gap-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-ui-dark-2 scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)} className="w-full border border-ui rounded-lg px-3 py-2 text-sm">
                <option value="">Everyone</option>
                {kids.map(k => <option key={k.uid} value={k.uid}>{k.name}</option>)}
              </select>
              <select value={reminderMinutes ?? ''} onChange={e => setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))} className="w-full border border-ui rounded-lg px-3 py-2 text-sm">
                <option value="">No reminder</option>
                {Object.entries(REMINDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isCountdown} onChange={e => setIsCountdown(e.target.checked)} className="rounded" />
                Show as countdown
              </label>
            </>
          ) : (
            <>
              {event.description && <p className="text-sm text-ui-secondary">{event.description}</p>}
              {assignee && <p className="text-sm text-ui-muted">Assigned to: {assignee.name}</p>}
              {event.reminderMinutes != null && <p className="text-sm text-ui-muted">Reminder: {REMINDER_LABELS[event.reminderMinutes] || `${event.reminderMinutes} min before`}</p>}
              {event.isCountdown ? <p className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg inline-block">Countdown event</p> : null}
            </>
          )}
        </div>

        {isParent && (
          <div className="flex gap-2 p-4 border-t">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-ui-soft-2 text-ui-secondary rounded-xl text-sm font-semibold">Cancel</button>
                {isRecurring && !showEditScope ? (
                  <button onClick={() => setShowEditScope(true)} disabled={saving} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold">Save</button>
                ) : isRecurring && showEditScope ? (
                  <div className="flex-1 flex gap-2">
                    <button onClick={() => handleSave('one')} className="flex-1 py-2 bg-blue-400 text-white rounded-xl text-xs font-semibold">Just this</button>
                    <button onClick={() => handleSave('future')} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">This & future</button>
                  </div>
                ) : (
                  <button onClick={() => handleSave('one')} disabled={saving} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold">{saving ? 'Saving…' : 'Save'}</button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 bg-ui-soft-2 text-ui-secondary rounded-xl text-sm font-semibold hover:bg-ui-soft-3">
                  <Edit2 size={14} /> Edit
                </button>
                <div className="flex-1" />
                {!showDeleteScope ? (
                  <button onClick={() => isRecurring ? setShowDeleteScope(true) : handleDelete('one')} className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm font-semibold hover:bg-rose-100">
                    <Trash2 size={14} /> Delete
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete('one')} className="px-3 py-2 bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold">Just this</button>
                    <button onClick={() => handleDelete('future')} className="px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold">This & future</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```
git commit -m "feat: EventDetailModal — view/edit/delete with recurring scope picker"
```

---

### Task 8: Wire onEventClick through all calendar sub-views

**Files:**
- Modify: `src/components/calendar/CalendarMonthView.tsx`
- Modify: `src/components/calendar/CalendarWeekView.tsx`
- Modify: `src/components/calendar/CalendarDayView.tsx`
- Modify: `src/components/calendar/AgendaView.tsx`

- [ ] **Step 1: Add onEventClick prop to each view**

For each of the 4 files, add `onEventClick?: (event: CalendarEvent) => void` to the props interface and wire it to each event element's `onClick` handler.

Example for `CalendarMonthView.tsx` — find where event chips are rendered and add:
```tsx
onClick={() => onEventClick?.(event)}
```

For `CalendarWeekView.tsx` and `CalendarDayView.tsx`, also add an **all-day top strip**:
```tsx
{/* All-day strip */}
{allDayEvents.length > 0 && (
  <div className="flex gap-1 px-2 py-1 border-b border-ui-soft bg-ui-soft min-h-[32px] flex-wrap">
    {allDayEvents.map(ev => (
      <button key={ev.id} onClick={() => onEventClick?.(ev)}
        className="px-2 py-0.5 rounded text-xs font-semibold text-white truncate max-w-[120px]"
        style={{ backgroundColor: ev.color }}>
        {ev.title}
      </button>
    ))}
  </div>
)}
```

Where `allDayEvents = events.filter(e => e.isAllDay)` and time-grid events = `events.filter(e => !e.isAllDay)`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```
git commit -m "feat: wire onEventClick to all calendar sub-views; all-day strip in week/day views"
```

---

### Task 9: Wire EventDetailModal in CalendarView

**Files:**
- Modify: `src/components/calendar/CalendarView.tsx`

- [ ] **Step 1: Add selectedEvent state and render EventDetailModal**

Add import: `import { EventDetailModal } from './EventDetailModal';`

Add state: `const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);`

Pass to each sub-view: `onEventClick={(ev) => setSelectedEvent(ev)}`

Add after the existing `AddEventModal` block:
```tsx
{selectedEvent && (
  <EventDetailModal
    event={selectedEvent}
    kids={kids}
    userRole={profile?.role ?? 'parent'}
    onClose={() => setSelectedEvent(null)}
    onUpdated={() => { setSelectedEvent(null); fetchEvents(); }}
  />
)}
```

Note: `CalendarView` currently doesn't receive `profile` — either pass it as a prop or read role from JWT decoded in a hook. Simplest: add `userRole: 'parent' | 'kid'` prop to `CalendarView`.

- [ ] **Step 2: Update CalendarView props interface**

```typescript
interface Props {
  parentId: string;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
  isLocked?: boolean;
  userRole?: 'parent' | 'kid'; // new
}
```

Update `App.tsx` to pass `userRole={profile?.role ?? 'parent'}`.

- [ ] **Step 3: Run lint + full test suite**

Run: `npm run lint && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```
git commit -m "feat: CalendarView — selectedEvent state, EventDetailModal integration, userRole prop"
```

---


