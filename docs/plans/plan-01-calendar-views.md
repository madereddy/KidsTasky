# Plan 01 — Functional Calendar Views

**Group:** A (no dependencies, start immediately)
**Blocks:** Plans 02, 04, 06, 08

---

## Problem

`CalendarMonthView.tsx` is a hollow placeholder. It renders 35 fixed cells with wrong date numbers and dumps every event into cell 0. There is no Month/Week/Day/Agenda logic. The calendar is never rendered anywhere in `App.tsx` — there is no calendar tab.

---

## What Already Exists

- `src/components/calendar/CalendarMonthView.tsx` — placeholder to replace
- `src/components/calendar/WeeklyWeather.tsx` — working weather chip row (wired in Plan 06)
- `src/services/events.ts` — `getEvents(parentId)`, `createEvent(event)`
- Backend `GET /parents/:parentId/events` and `POST /events` — fully working
- `CalendarEvent` type: `{ id, parentId, title, description, startTime: number, endTime: number, assignedToId?, color, externalId?, source? }`

---

## Files to Create

### `src/components/calendar/CalendarView.tsx`
Top-level wrapper. Owns all calendar state.

- State: `viewMode: 'month' | 'week' | 'day' | 'agenda'`, `currentDate: Date`, `events: CalendarEvent[]`, `selectedDay: Date | null`
- On mount: fetch events via `eventsClientService.getEvents(parentId)`
- Re-fetch after any event create/delete
- Renders:
  - Top bar: view-mode switcher (Month / Week / Day / Agenda buttons), prev/next arrows, today button, current date label, "+ Add Event" button
  - Active sub-view based on `viewMode`
  - `<AddEventModal>` when triggered
- Props: `parentId: string`, `kids: UserProfile[]`, `memberColorMap: Record<string, string>` (passed from parent, built in Plan 02 — accept optional empty object for now)

### `src/components/calendar/CalendarWeekView.tsx`
7-column time-grid.

- Props: `events: CalendarEvent[]`, `weekStart: Date`, `memberColorMap`
- Render a column per day (Sun–Sat), time axis on left (hourly labels 12am–11pm)
- Event position: `top = (startMinuteOfDay / 1440) * gridHeight`, `height = (durationMinutes / 1440) * gridHeight`
- Highlight today's column
- Click event chip → show event detail popover (title, time, description, assigned member)
- All-day events row at the top of the grid

### `src/components/calendar/CalendarDayView.tsx`
Single day, full-width time grid.

- Props: `events: CalendarEvent[]`, `day: Date`, `memberColorMap`, `weatherEntry?: DailyForecast`
- Same time-slot layout as week view but one column
- Weather summary card at top (populated in Plan 06 — accept optional prop now)
- Meal plan row at top (populated in Plan 04 — accept optional prop now)
- Click a time slot → pre-fills the add-event modal with that time

### `src/components/calendar/AgendaView.tsx`
Scrollable upcoming event list.

- Props: `events: CalendarEvent[]`, `startDate: Date`, `memberColorMap`
- Group events by date (`YYYY-MM-DD`); skip dates with no events
- Show dates as sticky section headers (formatted: "Monday, May 25")
- Each event: time range, color dot, title, assigned member name
- Show next 60 days from `startDate`

### `src/components/calendar/AddEventModal.tsx`
Create/edit event form.

- Props: `onClose`, `onSubmit(event)`, `kids: UserProfile[]`, `parentId`, `defaultDate?: Date`, `defaultStartTime?: string`
- Fields:
  - Title (required)
  - Description (optional textarea)
  - Date picker (`<input type="date">`)
  - Start time + End time (`<input type="time">`)
  - Color swatch picker (6 preset colors)
  - Assigned to (dropdown: "Everyone" + each kid by name)
- Submit calls `eventsClientService.createEvent()`, then fires `onSubmit` callback

---

## Files to Modify

### `src/components/calendar/CalendarMonthView.tsx`
Replace placeholder entirely. Keep the filename.

- Props: `events: CalendarEvent[]`, `currentMonth: Date`, `onDayClick: (date: Date) => void`, `memberColorMap`
- Calendar math:
  ```ts
  const firstDay = new Date(year, month, 1).getDay();       // 0-6 offset
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // 28-31
  ```
- Render 7-col grid:
  - Header row: Sun Mon Tue Wed Thu Fri Sat
  - `firstDay` empty leading cells
  - One cell per day: date number, up to 3 event chips, "+N more" overflow badge
- Event chips: colored pill with truncated title, derived from `memberColorMap[event.assignedToId] ?? event.color`
- Today's cell gets a highlighted ring
- Click a cell → `onDayClick(date)` which switches `CalendarView` to day view for that date

### `src/services/events.ts`
Add missing methods:

```ts
deleteEvent: async (id: string) => fetchAPI(`/events/${id}`, { method: 'DELETE' })
updateEvent: async (id: string, data: Partial<CalendarEvent>) =>
  fetchAPI(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) })
```

### `src/server/modules/events/routes.ts`
Verify `PUT /events/:id` and `DELETE /events/:id` exist. Add if missing:

```ts
eventsRouter.put('/events/:id', requireAuth, (req, res) => { ... })
eventsRouter.delete('/events/:id', requireAuth, (req, res) => { ... })
```

### `src/server/modules/events/service.ts`
Verify `updateEvent(id, data)` and `deleteEvent(id)` exist. Add if missing.

### `src/App.tsx`
- Add `activeSection: 'tasks' | 'calendar'` state (default `'tasks'`)
- Add Calendar nav button to header (parent-only, or both roles)
- Conditionally render `<CalendarView>` vs current task dashboards
- Pass `profile`, `kids` (fetch in App or pass down), `memberColorMap` to `CalendarView`

---

## Key Implementation Notes

- `CalendarEvent.startTime` and `endTime` are **Unix milliseconds** (number). Convert to `Date` with `new Date(event.startTime)`.
- Date cell matching: `new Date(event.startTime).toISOString().slice(0,10)` gives `YYYY-MM-DD` for grouping.
- Week view height: use `min-h-[1440px]` for the grid (1px per minute) or scale to `960px` (0.667px/min). Either works; pick one and be consistent.
- Don't use a calendar library (date-fns is already installed — use its `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `format`, `isSameDay` helpers).

---

## Acceptance Criteria

- [ ] Month view shows correct dates for any month, correct day-of-week alignment
- [ ] Events appear in their correct date cells
- [ ] Week and Day views show events as positioned time blocks
- [ ] Agenda view lists upcoming events grouped by date
- [ ] Add event form creates an event visible immediately on the calendar
- [ ] Prev/next navigation works in all views
- [ ] Calendar tab is accessible from the main header nav
