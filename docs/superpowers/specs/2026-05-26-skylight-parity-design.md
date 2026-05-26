# Skylight Parity — Feature Gap Design

**Date:** 2026-05-26  
**Scope:** Close remaining gaps between KidsTasky and Skylight Calendar feature parity  
**Approach:** Risk-first parallel execution (Group B solo → A+C parallel → D → E)

---

## Background

All 11 original Skylight clone plans are implemented. This spec covers the remaining gaps identified by full repo audit:

**Critical/High:** recurring events, event edit/delete, all-day events, reliability fixes, task approval UI  
**Medium:** push+email event reminders, co-parent accounts  
**Low:** countdown widgets, family bulletin board, kid avatars

---

## Execution Order

```
Group B (Reliability)     ─── solo, ships first (2 days)
         │
         ▼
Group A (Calendar Core) ──┐
Group C (Family/Auth)   ──┤ parallel (3 days)
         │                │
         ▼                ▼
Group D (Notifications)   ─── needs A's event schema (2 days)
         │
         ▼
Group E (Polish)          ─── no hard blockers (1 day)
```

---

## Group B — Reliability Fixes

**Fully specced** in `docs/superpowers/plans/2026-05-26-reliability-fixes.md`. No design changes needed.

Summary of 14 tasks:
- SQLite `foreign_keys = ON` + `synchronous = FULL`
- `authenticateUser` + `getParentId()` ownership checks on all unprotected routes (events, notifications, sync, tasks, rewards)
- Stars double-award fix (`INSERT ... ON CONFLICT DO NOTHING`), refund on completion delete
- Socket.IO JWT verification on `join-room`
- Email format validation, 8+ char password minimum
- IMAP connection leak fix (try/finally per connection)
- Stale socket closures fixed with `useRef`
- HTTP retry with exponential backoff for 5xx/network errors
- App init error UI with retry button
- Category socket refetch

---

## Group A — Calendar Core

### A1: Schema Migration

New migration `027_add_recurring_allday_countdown.sql`:

```sql
ALTER TABLE events ADD COLUMN isAllDay INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN masterId TEXT;
ALTER TABLE events ADD COLUMN recurrence TEXT DEFAULT 'none';
ALTER TABLE events ADD COLUMN recurrenceEnd TEXT;
ALTER TABLE events ADD COLUMN isCountdown INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN reminderMinutes INTEGER;
```

### A2: Recurring Events

**Strategy:** expand upfront on create, not on read. Creating a recurring event generates individual event rows sharing a `masterId` UUID, up to 1 year ahead. No server-side expansion logic at query time — existing `SELECT * WHERE parentId = ?` queries work unchanged.

**Patterns:** `none | daily | weekly | monthly | yearly`

**Generation logic** in `eventsService.createRecurringEvents(master, recurrence, endDate)`:
- Daily: one row per day from startDate to min(endDate, startDate+365d)
- Weekly: one row per week on same weekday
- Monthly: one row per month on same day-of-month
- Yearly: one row per year (capped at 5 years for yearly)

**Edit scope:** when editing a recurring instance, user picks:
- "Just this event" — update single row
- "This and all future" — update all rows where `masterId = X AND startTime >= thisEvent.startTime`

**Delete scope:** same two options.

**Files modified:**
- `src/server/migrations/027_add_recurring_allday_countdown.sql` (new)
- `src/server/modules/events/service.ts` — add `createRecurringEvents`, update `updateEvent(id, data, scope)`, update `deleteEvent(id, scope)`
- `src/server/modules/events/routes.ts` — pass `scope` query param to service
- `src/types.ts` — add `isAllDay`, `masterId`, `recurrence`, `recurrenceEnd`, `isCountdown`, `reminderMinutes` to `CalendarEvent`
- `src/components/calendar/AddEventModal.tsx` — recurrence picker + end date + all-day toggle + reminder picker
- `src/services/events.ts` — pass new fields to API

### A3: Event Edit/Delete (EventDetailModal)

New component `src/components/calendar/EventDetailModal.tsx`:
- Triggered by `onEventClick(event)` in any calendar view
- Shows: title, description, date/time (or all-day), color swatch, assignee name, recurrence label, reminder setting, countdown toggle
- **Edit mode**: inline form fields, Save/Cancel buttons
- **Delete**: red button, scope picker if recurring (`ConfirmDeleteModal` inline)
- Parent-only actions when `isLocked=true`: hide edit/delete

**Props plumbing:**
- `CalendarMonthView`, `CalendarWeekView`, `CalendarDayView`, `AgendaView` all receive `onEventClick?: (event: CalendarEvent) => void`
- `CalendarView` owns `selectedEvent` state + renders `EventDetailModal`

### A4: All-Day Events

- `AddEventModal`: "All day" toggle — when on, hides start/end time pickers, sets `isAllDay=1`, stores `startTime` as midnight of selected date, `endTime` as 23:59:59 of same date
- `CalendarWeekView` + `CalendarDayView`: render all-day events in a pinned top strip above the time grid
- `CalendarMonthView`: no change needed — events render as color blocks already

---

## Group C — Family & Auth

### C1: Co-Parent Accounts

**Model:** co-parent gets `role='parent'` + `parentId=<owner uid>` in JWT. All service queries use `getParentId()` already — co-parents get full family access automatically.

**Schema** (new migration `028_add_coparent_invite_type.sql`):
```sql
ALTER TABLE invites ADD COLUMN type TEXT DEFAULT 'kid';
```

**Invite flow:**
1. Family owner opens Settings → "Add Co-Parent" button → calls `POST /invites` with `{ type: 'coparent' }`
2. Server generates 6-char code, stores with `type='coparent'`
3. Co-parent downloads/opens app → "Join as Co-Parent" option on login screen → enters code
4. Server detects `type='coparent'` → creates user with `role='parent'` + `parentId=<owner uid>`
5. JWT issued with co-parent's uid, role=parent, parentId=owner uid

**Removal:** Settings shows list of co-parents (query users where `parentId=ownerUid AND uid != ownerUid`). Owner can remove — sets `parentId=null` on co-parent account (effectively orphans them).

**Files modified:**
- `src/server/migrations/028_add_coparent_invite_type.sql` (new)
- `src/server/modules/invites/service.ts` — add `type` param to `createInvite`, detect type in join flow
- `src/server/modules/auth/routes.ts` — handle co-parent join path in `/join` endpoint
- `src/components/parent/SettingsView.tsx` — "Add Co-Parent" section with invite code display + co-parent list
- `src/components/auth/LoginView.tsx` — "Join as Co-Parent" flow (reuse join flow, different label)
- `src/components/onboarding/OnboardingView.tsx` — detect `type=coparent` in invite response

### C2: Task Completion Approval UI

Schema already has `requiresApproval` on tasks and `approvalStatus` on completions.

**New routes:**
- `POST /completions/:id/approve` — set `approvalStatus='approved'`, award stars + XP to kid
- `POST /completions/:id/reject` — set `approvalStatus='rejected'`, no stars

**Parent dashboard** gets "Pending Approvals" section above task list:
- Query: completions where `approvalStatus='pending'` for all tasks in this family
- Shows kid name, task title, completed-at timestamp
- Approve (green) / Reject (red) buttons per item
- On action: updates UI optimistically, emits socket `staleData`

**Kid dashboard:**
- Completed tasks with `requiresApproval=true` and `approvalStatus='pending'` show "⏳ Awaiting approval" pill instead of XP animation
- `approvalStatus='rejected'`: show "✗ Not approved" pill, task re-appears as completable
- `approvalStatus='approved'`: normal XP/star animation plays (deferred until approval)

**Files modified:**
- `src/server/modules/tasks/service.ts` — add `approveCompletion`, `rejectCompletion`
- `src/server/modules/tasks/routes.ts` — add approve/reject endpoints
- `src/services/tasks.ts` — add client methods
- `src/components/parent/ParentDashboard.tsx` — pending approvals section
- `src/components/kid/KidDashboard.tsx` — approval status display on task cards
- `src/components/kid/TaskCard.tsx` — `approvalStatus` prop rendering

---

## Group D — Push Notifications & Event Reminders

### D1: Schema

New migration `029_add_push_and_reminders.sql`:
```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  parentId TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_reminders (
  eventId TEXT NOT NULL,
  sentAt INTEGER NOT NULL,
  PRIMARY KEY (eventId, sentAt)
);
```

### D2: VAPID / Web Push Setup

- `npm install web-push`
- VAPID keys generated once: `npx web-push generate-vapid-keys` → stored in `.env` as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- `.env.example` updated with these three vars

**Routes:**
- `GET /notifications/vapid-public-key` — returns public key (unauthenticated, needed before subscription)
- `POST /notifications/subscribe` — stores push subscription, requires auth
- `DELETE /notifications/subscribe` — removes subscription on logout

**Service worker** `public/sw.js`:
```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: data
    })
  );
});
```

**Client** `src/services/push.ts`:
- `subscribeToNotifications()` — requests permission, subscribes via service worker, POSTs to server
- `unsubscribeFromNotifications()` — removes subscription
- Called from `App.tsx` after successful login (non-blocking, silent fail on deny)

### D3: Email Reminders

- `npm install nodemailer`
- Env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- If `SMTP_HOST` not set: skip email silently
- `src/server/modules/notifications/emailService.ts` — `sendEventReminder(to, eventTitle, startTime)`

### D4: Worker Cron Job

`src/server/worker.ts` gets new job running every 60 seconds:

```
1. For each reminderMinutes value in [0, 5, 10, 15, 30, 60, 1440]:
   - Query events where reminderMinutes=X 
     AND startTime BETWEEN (now + X*60000 - 30000) AND (now + X*60000 + 30000)
   - Skip if eventId already in sent_reminders for this window
   - Send web push to all push_subscriptions for that parentId
   - Send email to parent + all co-parents
   - Insert into sent_reminders
```

**Reminder picker UI:** `AddEventModal` + `EventDetailModal` get a "Remind me" dropdown: None / At time / 5 min before / 10 min / 15 min / 30 min / 1 hour / 1 day before.

---

## Group E — Polish

### E1: Countdown Widgets

`isCountdown INTEGER DEFAULT 0` already added in Group A migration.

`AddEventModal` + `EventDetailModal`: "Show as countdown" toggle (only relevant when event is in the future).

**Wall mode panel** (in `CalendarView.tsx`) gets a "Countdowns" card row:
- Query: `events WHERE isCountdown=1 AND startTime > now`, ordered by `startTime ASC`, limit 3
- Render: "🎂 Liam's Birthday — 12 days" chips
- Falls back to empty state "No countdowns set"

### E2: Family Bulletin Board

New migration `030_add_family_notes.sql`:
```sql
CREATE TABLE IF NOT EXISTS family_notes (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  updatedAt INTEGER NOT NULL,
  updatedByName TEXT
);
```

**Routes:**
- `GET /family-notes/:parentId` — returns note or `{ content: '', updatedAt: null }`
- `PUT /family-notes/:parentId` — upsert, requires auth, sets `updatedByName` from JWT user name
- Emits `staleData` on save

**Component** `src/components/shared/FamilyNote.tsx`:
- Yellow sticky-note card aesthetic
- Click → `<textarea>` inline edit → save on blur or Enter
- Shows "Last updated by [name], [relative time]" footer
- Displayed on: wall mode panel + parent dashboard sidebar + kid dashboard (read-only for kids)

### E3: Kid Avatars

New migration `031_add_user_avatar.sql`:
```sql
ALTER TABLE users ADD COLUMN avatarPreset TEXT;
ALTER TABLE users ADD COLUMN avatarUrl TEXT;
```

**24 preset avatars** defined as constants in `src/constants.ts` — emoji + label pairs:
`🦊 Fox`, `🐼 Panda`, `🦁 Lion`, `🐸 Frog`, `🚀 Rocket`, `🦄 Unicorn`, `🐉 Dragon`, `🦋 Butterfly`, etc.

**Route:** `PUT /users/:uid/avatar` — accepts `{ avatarPreset?: string, avatarUrl?: string }`, validates ownership

**Component** `src/components/shared/AvatarPicker.tsx`:
- Modal: 4×6 grid of preset emojis + "Upload photo" button at bottom
- Upload reuses `photosClientService.uploadPhoto()`, stores returned URL
- On select: calls `/users/:uid/avatar` endpoint

**Avatar display priority:** `avatarUrl` → emoji from `avatarPreset` → initial letter fallback

**Avatar used in:**
- `KidDashboard` header (replaces initial circle)
- `ParentDashboard` kid list (replaces initial circle)
- `TaskCard` assignee indicator
- `AgendaView` event assignee pip

**Route:** `PUT /users/:uid/avatar` with ownership check (can only update own avatar, or parent can update kid in their family)

---

## PWA Manifest

New file `public/manifest.json`:
```json
{
  "name": "KidsTasky",
  "short_name": "KidsTasky",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`index.html` gets `<link rel="manifest" href="/manifest.json">` and `<meta name="theme-color" content="#3b82f6">`.

Placeholder icons (`icon-192.png`, `icon-512.png`) added to `public/`.

Service worker registration added to `src/main.tsx` (same SW used for push notifications).

---

## Files Added / Modified Summary

| File | Group | Action |
|------|-------|--------|
| `src/server/migrations/027_add_recurring_allday_countdown.sql` | A | New |
| `src/server/migrations/028_add_coparent_invite_type.sql` | C | New |
| `src/server/migrations/029_add_push_and_reminders.sql` | D | New |
| `src/server/migrations/030_add_family_notes.sql` | E | New |
| `src/server/migrations/031_add_user_avatar.sql` | E | New |
| `src/types.ts` | A,C,D,E | Modify |
| `src/server/modules/events/service.ts` | A | Modify |
| `src/server/modules/events/routes.ts` | A | Modify |
| `src/server/modules/tasks/service.ts` | C | Modify |
| `src/server/modules/tasks/routes.ts` | C | Modify |
| `src/server/modules/invites/service.ts` | C | Modify |
| `src/server/modules/auth/routes.ts` | C | Modify |
| `src/server/modules/notifications/routes.ts` | D | Modify |
| `src/server/modules/notifications/emailService.ts` | D | New |
| `src/server/worker.ts` | D | Modify |
| `src/components/calendar/AddEventModal.tsx` | A,D | Modify |
| `src/components/calendar/EventDetailModal.tsx` | A | New |
| `src/components/calendar/CalendarView.tsx` | A,E | Modify |
| `src/components/calendar/CalendarMonthView.tsx` | A | Modify |
| `src/components/calendar/CalendarWeekView.tsx` | A | Modify |
| `src/components/calendar/CalendarDayView.tsx` | A | Modify |
| `src/components/calendar/AgendaView.tsx` | A,E | Modify |
| `src/components/parent/ParentDashboard.tsx` | C | Modify |
| `src/components/parent/SettingsView.tsx` | C | Modify |
| `src/components/kid/KidDashboard.tsx` | C,E | Modify |
| `src/components/kid/TaskCard.tsx` | C,E | Modify |
| `src/components/auth/LoginView.tsx` | C | Modify |
| `src/components/onboarding/OnboardingView.tsx` | C | Modify |
| `src/components/shared/FamilyNote.tsx` | E | New |
| `src/components/shared/AvatarPicker.tsx` | E | New |
| `src/services/push.ts` | D | New |
| `src/services/events.ts` | A | Modify |
| `src/services/tasks.ts` | C | Modify |
| `src/App.tsx` | D | Modify |
| `src/main.tsx` | D | Modify |
| `src/constants.ts` | E | Modify |
| `public/sw.js` | D | New |
| `public/manifest.json` | D | New |
| `public/icon-192.png` | D | New |
| `public/icon-512.png` | D | New |
| `.env.example` | D | Modify |

---

## Definition of Done

- [ ] All 14 reliability tasks from existing plan pass tests
- [ ] Recurring events create, display, edit (one/future), and delete (one/future) correctly
- [ ] Clicking any event opens EventDetailModal with edit and delete
- [ ] All-day events render in top strip of week/day views
- [ ] Co-parent can join via invite code, gets full parent access
- [ ] Owner can remove co-parent from Settings
- [ ] Tasks with `requiresApproval` show pending queue on parent dashboard
- [ ] Approve/reject updates kid dashboard in real-time
- [ ] Web push notifications fire for events with `reminderMinutes` set
- [ ] Email reminders fire when SMTP configured
- [ ] No duplicate reminders sent
- [ ] PWA manifest present, app installable on Android/desktop
- [ ] Countdown chips appear in wall mode for future countdown events
- [ ] Family note persists, updates real-time across clients
- [ ] Kid avatars save (preset + upload), display in dashboard and task cards
