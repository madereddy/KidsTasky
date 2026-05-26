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

**Fully specced** in `docs/superpowers/plans/2026-05-26-reliability-fixes.md`.

**Pre-implementation notes (already done — skip these tasks):**
- `foreign_keys = ON` and `synchronous = FULL` are already set in `src/server/db.ts` lines 28-29. Skip reliability plan Task 1.
- `approveCompletion` and `rejectCompletion` already exist in `src/server/modules/tasks/service.ts` and routes use `PATCH /completions/:id/approve` and `PATCH /completions/:id/reject`. Skip those sub-tasks in Task 6.

**Migration runner behavior (confirmed):** `src/server/migrate.ts` is filename-based, tracks applied versions via `schema_version` table, and catches `duplicate column name` errors gracefully. The existing gap (migration 014 is absent — numbering jumps 013→015) is benign. New migrations 027–031 will apply correctly.

Remaining 12 tasks: auth ownership checks on routes, stars double-award fix, socket JWT verification, email/password validation, IMAP connection leak, stale socket closures, HTTP retry backoff, App init error UI, category socket refetch.

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

-- Performance: existing GET /events fetches all rows for parentId.
-- With recurring expansion this can reach hundreds of rows per family.
-- Add index to support future date-range filtering.
CREATE INDEX IF NOT EXISTS idx_events_parent_start ON events(parentId, startTime);
```

### A2: Recurring Events

**Strategy:** expand upfront on create, not on read. Creating a recurring event generates individual event rows sharing a `masterId` UUID (generated server-side), up to 1 year ahead. No server-side expansion logic at query time — existing `SELECT * WHERE parentId = ?` queries work unchanged.

**Patterns:** `none | daily | weekly | monthly | yearly`

**Generation logic** in `eventsService.createRecurringEvents(master, recurrence, endDate)`:
- Daily: one row per day from startDate to `min(endDate, startDate+365d)`
- Weekly: one row per week on same weekday
- Monthly: one row per month — clamp day to last day of each target month (e.g. Jan 31 → Feb 28/29 → Mar 31). Use `new Date(year, month+1, 0).getDate()` to get last day.
- Yearly: one row per year, capped at 5 years. Feb 29 events resolve to Feb 28 in non-leap years.

**Edit scope:** when editing a recurring instance, user picks:
- "Just this event" — update single row by id
- "This and all future" — `UPDATE events SET ... WHERE masterId = X AND startTime >= thisEvent.startTime`

**Time-change edits (scope=future):** if `startTime` or `endTime` changes, apply a delta rather than a literal value:
```sql
UPDATE events SET startTime = startTime + delta, endTime = endTime + delta, ... WHERE masterId = X AND startTime >= thisEvent.startTime
```
where `delta = newStartTime - thisEvent.startTime`. This preserves relative offsets between future instances. For non-time-change edits (title, color, etc.) a literal value UPDATE is correct.

The `updateEvent` service method must include all new columns in its SET clause: `title, description, startTime, endTime, assignedToId, color, isAllDay, recurrence, recurrenceEnd, reminderMinutes, isCountdown`.

**Delete scope:** same two options via `DELETE ... WHERE masterId = X AND startTime >= thisEvent.startTime`.

**Google Calendar sync note:** KidsTasky uses the upfront-expansion strategy (individual rows, no RRULE). When "this and future" edit fires, each updated row gets an individual PATCH call to Google. The existing sync route already handles per-event external updates — no special handling needed beyond iterating the affected rows.

**"This and future" orphaned head handling:** when scope=`future` targets a middle instance (not the first), the first part of the series becomes orphaned — it still has `masterId` set but the series is now shorter. Update the immediate predecessor's `recurrenceEnd` to `thisEvent.startTime - 1` to cap it. If no predecessor exists (targeting the first instance), generate a new UUID and UPDATE all surviving rows with `masterId = newUuid` directly — do NOT first null out `masterId` or clear `recurrence`. The surviving rows become a new series with the new UUID and retain their recurrence metadata.

**`createEvent` column security:** the service must use an explicit named INSERT with all accepted columns rather than spreading `req.body`. The route must extract only the allowed fields before passing to the service.

**Files modified:**
- `src/server/migrations/027_add_recurring_allday_countdown.sql` (new)
- `src/server/modules/events/service.ts` — update `createEvent` with explicit named INSERT for all new columns; add `createRecurringEvents`; update `updateEvent(id, data, scope: 'one'|'future')` with full SET clause and orphaned-head logic; update `deleteEvent(id, scope: 'one'|'future')`
- `src/server/modules/events/routes.ts` — extract allowed fields explicitly before calling service; pass `scope` query param; iterate rows for "future" Google sync
- `src/types.ts` — add `isAllDay`, `masterId`, `recurrence`, `recurrenceEnd`, `isCountdown`, `reminderMinutes` to `CalendarEvent`
- `src/components/calendar/AddEventModal.tsx` — recurrence picker (None/Daily/Weekly/Monthly/Yearly) + optional recurrence end date + all-day toggle + reminder picker
- `src/services/events.ts` — pass new fields to API

### A3: Event Edit/Delete (EventDetailModal)

New component `src/components/calendar/EventDetailModal.tsx`:
- Triggered by `onEventClick(event)` in any calendar view
- Shows: title, description, date/time (or all-day badge), color swatch, assignee name, recurrence label, reminder setting, countdown toggle
- **Edit mode**: inline form fields, Save/Cancel buttons
- **Delete**: red button; if `masterId` present, scope picker appears inline ("Just this" / "This and future")
- Edit/delete hidden when `profile.role !== 'parent'` (kids are view-only). Do NOT use `isLocked` for this check — `isLocked` is the parental wall-display lock, not a role check.

**Props plumbing:**
- `CalendarMonthView`, `CalendarWeekView`, `CalendarDayView`, `AgendaView` all receive `onEventClick?: (event: CalendarEvent) => void`
- `CalendarView` owns `selectedEvent: CalendarEvent | null` state + renders `EventDetailModal`

### A4: All-Day Events

- `AddEventModal`: "All day" toggle — when on, hides start/end time pickers, sets `isAllDay=1`
- All-day event timestamps: store `startTime` as midnight of the selected date computed in the family's configured timezone (read from `family_settings.timezone`). Timezone-naive midnight (local `new Date(dateStr)`) is insufficient for self-hosted setups where server and client timezones differ.
- `CalendarWeekView` + `CalendarDayView`: render all-day events in a pinned top strip above the time grid
- `CalendarMonthView`: no change needed — events render as color blocks already

---

## Group C — Family & Auth

### C1: Co-Parent Accounts

**Model:** co-parent gets `role='parent'` + `parentId=<owner uid>` in JWT. All service queries use `getParentId()` already — co-parents get full family access automatically.

**Schema** (new migration `028_add_coparent_invite_type.sql`):
```sql
ALTER TABLE invites ADD COLUMN type TEXT DEFAULT 'kid';
ALTER TABLE users ADD COLUMN revokedAt INTEGER;
```

(`revokedAt` enables token invalidation on co-parent removal without changing JWT expiry.)

**Invite flow:**
1. Family owner opens Settings → "Add Co-Parent" button → calls `POST /invites` with `{ type: 'coparent' }`
2. Server generates 6-char code, stores with `type='coparent'`
3. Co-parent opens app → "Join as Co-Parent" link on login screen → enters code
4. Client calls `GET /invites/:code/validate` — response must include `type` field (update invites route to return it)
5. `OnboardingView` detects `invite.type === 'coparent'` → shows "Join as co-parent" branch
6. User creation endpoint (`POST /users` in `src/server/modules/users/routes.ts`) re-reads `type` from the validated invite DB row — never trusts `type` from the request body. Only when invite row has `type='coparent'` does it set `role='parent'` + `parentId=<owner uid>`. Invite is marked `status='used'` after successful join. Malicious callers supplying `type='coparent'` in the body without a valid code are rejected.
7. JWT issued normally

**Files modified for co-parent join:**
- `src/server/migrations/028_add_coparent_invite_type.sql` (new)
- `src/server/modules/invites/service.ts` — add `type` param to `createInvite`
- `src/server/modules/invites/routes.ts` — ensure `GET /invites/:code/validate` returns `type` field; update `POST /invites` to accept `type`
- `src/server/modules/users/routes.ts` — detect `type='coparent'` in join path, set `role='parent'` + `parentId`
- `src/components/parent/SettingsView.tsx` — "Add Co-Parent" section with invite code display + co-parent list
- `src/components/auth/LoginView.tsx` — "Join as Co-Parent" option
- `src/components/onboarding/OnboardingView.tsx` — branch on `invite.type === 'coparent'`

**Removal:** Settings shows list of co-parents (`SELECT * FROM users WHERE parentId=ownerUid AND role='parent' AND uid != ownerUid`). Owner removes a co-parent by:
1. `UPDATE users SET parentId=null, revokedAt=<now> WHERE uid=<coParentUid>` — use UPDATE only, never INSERT OR REPLACE, which would silently clear `revokedAt`
2. `DELETE FROM push_subscriptions WHERE userId=<coParentUid>`
3. Emitting `force-logout` socket event to all of the co-parent's connected sockets
4. Subsequent requests by the co-parent return 401 via `revokedAt` check in `authenticateUser`

**`revokedAt` check in `authenticateUser`** (one DB query per authenticated request — acceptable for SQLite self-hosted):
```typescript
const user = db.prepare('SELECT revokedAt FROM users WHERE uid = ?').get(payload.uid) as { revokedAt: number | null } | undefined;
if (user?.revokedAt && payload.iat && payload.iat * 1000 < user.revokedAt) {
  return res.status(401).json({ error: 'Token revoked' });
}
```

**Socket userId→socketId mapping** (add to `socketWrapper.init` in `src/server/socket.ts`):
```typescript
const userSocketMap = new Map<string, Set<string>>();

// In connection handler, after join-room JWT verify:
const existing = userSocketMap.get(userId) ?? new Set();
existing.add(socket.id);
userSocketMap.set(userId, existing);

socket.on('disconnect', () => {
  const sockets = userSocketMap.get(userId);
  if (sockets) { sockets.delete(socket.id); if (!sockets.size) userSocketMap.delete(userId); }
});

// Expose new method:
emitToUser: (userId: string, event: string, data?: any) => {
  userSocketMap.get(userId)?.forEach(socketId => io.to(socketId).emit(event, data));
}
```

**Files modified for removal:**
- `src/server/modules/users/routes.ts` — `DELETE /users/:uid/coparent` endpoint
- `src/server/modules/users/service.ts` — `removeCoParent(uid)` — UPDATE only (see above)
- `src/server/middleware/auth.ts` — add `revokedAt` check (see above)
- `src/server/socket.ts` — add userId→socketId map + `emitToUser` method

### C2: Task Completion Approval UI

**Already implemented (backend):** `approveCompletion` and `rejectCompletion` exist in `src/server/modules/tasks/service.ts`. Routes are `PATCH /completions/:completionId/approve` and `PATCH /completions/:completionId/reject` in `src/server/modules/tasks/routes.ts`. Client methods need to be added to `src/services/tasks.ts`.

**This group is pure UI work:**

**Parent dashboard** gets "Pending Approvals" section above task list:
- New service call: `tasksClientService.getPendingApprovals(parentId)` — `GET /tasks/pending-approvals/:parentId` returning completions with `approvalStatus='pending'` joined with task title + kid name
- Shows kid name, task title, completed-at timestamp
- Approve (green) / Reject (red) buttons per item
- On action: optimistic removal from list, emit socket `staleData`

**Kid dashboard:**
- Completed tasks with `requiresApproval=true` and `approvalStatus='pending'` show "⏳ Awaiting approval" pill instead of XP animation
- `approvalStatus='rejected'`: show "✗ Not approved" pill, task re-appears as completable (clear the completion locally)
- `approvalStatus='approved'`: XP/star animation plays when status changes (triggered via socket `staleData`)

**New backend route needed:**
- `GET /tasks/pending-approvals/:parentId` — returns completions with `approvalStatus='pending'` joined to task + kid info, scoped to `parentId`

**Files modified:**
- `src/server/modules/tasks/service.ts` — add `getPendingApprovals(parentId)`
- `src/server/modules/tasks/routes.ts` — add `GET /tasks/pending-approvals/:parentId`
- `src/services/tasks.ts` — add `getPendingApprovals`, `approveCompletion`, `rejectCompletion` client methods
- `src/components/parent/ParentDashboard.tsx` — pending approvals section
- `src/components/kid/KidDashboard.tsx` — approval status display
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

-- PK is (eventId, reminderMinutes): one row per event per reminder offset.
-- Simple, correct duplicate check without window arithmetic.
CREATE TABLE IF NOT EXISTS sent_reminders (
  eventId TEXT NOT NULL,
  reminderMinutes INTEGER NOT NULL,
  sentAt INTEGER NOT NULL,
  PRIMARY KEY (eventId, reminderMinutes)
);
```

### D2: VAPID / Web Push Setup

- `npm install web-push`
- VAPID keys generated once: `npx web-push generate-vapid-keys` → stored in `.env` as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- `.env.example` updated with these three vars + SMTP vars

**Routes** (added to `src/server/modules/notifications/routes.ts`):
- `GET /notifications/vapid-public-key` — unauthenticated, returns public key
- `POST /notifications/subscribe` — requires auth, stores push subscription. Body: full PushSubscription JSON object.
- `DELETE /notifications/subscribe` — **no `authenticateUser` middleware** on this route. Body: `{ endpoint }`. Deletes subscription row matching the endpoint URL. Unauthenticated by design: this is called during logout before the token is cleared, and must succeed even if the token has already expired. Endpoint URL is sufficient as a lookup key.

**Service worker** `public/sw.js` (also handles PWA install — see Group E):
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
- `subscribeToNotifications()` — fetches VAPID public key, requests `Notification` permission, subscribes via `serviceWorker.ready`, POSTs subscription to server. Non-blocking, silent fail if permission denied.
- `unsubscribeFromNotifications()` — gets subscription from SW, POSTs `{ endpoint }` to `DELETE /notifications/subscribe`, calls `subscription.unsubscribe()`. Must be called BEFORE token is cleared from localStorage.
- Both called from `App.tsx`: `subscribeToNotifications()` after login, `unsubscribeFromNotifications()` at start of logout flow.

### D3: Email Reminders

- `npm install nodemailer`
- If `SMTP_HOST` not set: all email calls are no-ops, logged at warn level
- `src/server/modules/notifications/emailService.ts` — `sendEventReminder(toAddresses: string[], eventTitle: string, startTime: number)`. Imported and called from `src/server/worker.ts` only (not from routes).

### D4: Worker Cron Job

`src/server/worker.ts` gets new job running every 60 seconds:

```
1. Compute now = Date.now()
2. For each reminderMinutes value in [0, 5, 10, 15, 30, 60, 1440]:
   - targetMs = now + reminderMinutes * 60000
   - Query: SELECT * FROM events 
       WHERE reminderMinutes = X
         AND startTime BETWEEN (targetMs - 60000) AND (targetMs + 60000)
   - For each matching event:
       - Skip if EXISTS in sent_reminders WHERE eventId=? AND reminderMinutes=X
       - Send web push to all push_subscriptions for that parentId
       - Send email to parent account + all co-parents (users WHERE parentId=event.parentId)
       - INSERT INTO sent_reminders (eventId, reminderMinutes, sentAt) VALUES (...)
```

The look-ahead window is ±60s (one full tick) rather than ±30s to survive minor event-loop delays. The `(eventId, reminderMinutes)` PK prevents double-sends without wall-clock ambiguity.

**Reminder picker UI:** `AddEventModal` + `EventDetailModal` get a "Remind me" dropdown: None / At time / 5 min before / 10 min / 15 min / 30 min / 1 hour / 1 day before.

---

## Group E — Polish + PWA

### E1: PWA Manifest & Service Worker

Service worker `public/sw.js` is shared with Group D push notifications. Group E adds the PWA install layer on top.

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

Placeholder icons (`icon-192.png`, `icon-512.png`) in `public/`. Service worker registered in `src/main.tsx`.

### E2: Countdown Widgets

`isCountdown INTEGER DEFAULT 0` added in Group A migration (A1).

`AddEventModal` + `EventDetailModal`: "Show as countdown" toggle (only shown when event `startTime > now`).

**Wall mode panel** (in `CalendarView.tsx`): countdown chips are a client-side filter on the already-fetched `events` array — no new API endpoint needed. Filter: `events.filter(e => e.isCountdown && e.startTime > Date.now())`, sort by `startTime ASC`, take first 3. Render as chips: "🎂 Liam's Birthday — 12 days". Empty state: "No countdowns set."

### E3: Family Bulletin Board

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

**Routes** (new module `src/server/modules/notes/`):
- `GET /family-notes/:parentId` — returns note row or `{ content: '', updatedAt: null }`
- `PUT /family-notes/:parentId` — upsert, requires auth, ownership check (`getParentId(req) === req.params.parentId`), sets `updatedByName` from JWT user name. Emits `staleData` on save. Must use explicit conflict-target SQL:
  ```sql
  INSERT INTO family_notes (id, parentId, content, updatedAt, updatedByName)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(parentId) DO UPDATE SET
    content = excluded.content,
    updatedAt = excluded.updatedAt,
    updatedByName = excluded.updatedByName
  ```
  A plain `INSERT` or `INSERT OR REPLACE` without `ON CONFLICT(parentId)` will fail on the second save with a UNIQUE constraint error.

**Component** `src/components/shared/FamilyNote.tsx`:
- Yellow sticky-note aesthetic
- Click → `<textarea>` inline edit → save on blur or Enter
- "Last updated by [name], [relative time]" footer
- Displayed on: wall mode panel + parent dashboard sidebar + kid dashboard (read-only for kids — disable `<textarea>` when `role === 'kid'`)

### E4: Kid Avatars

New migration `031_add_user_avatar.sql`:
```sql
ALTER TABLE users ADD COLUMN avatarPreset TEXT;
ALTER TABLE users ADD COLUMN avatarUrl TEXT;
```

**24 preset avatars** in `src/constants.ts` as `AVATAR_PRESETS: Array<{ id: string; emoji: string; label: string }>`:
`🦊 Fox`, `🐼 Panda`, `🦁 Lion`, `🐸 Frog`, `🚀 Rocket`, `🦄 Unicorn`, `🐉 Dragon`, `🦋 Butterfly`, `🐬 Dolphin`, `🦅 Eagle`, `🐺 Wolf`, `🌟 Star`, `⚡ Bolt`, `🎮 Gamer`, `🎨 Artist`, `🏆 Champ`, `🐢 Turtle`, `🐾 Paws`, `🐧 Penguin`, `🦓 Zebra`, `🐙 Octopus`, `🦜 Parrot`, `🐻 Bear`, `🦈 Shark`

**Route:** `PUT /users/:uid/avatar` — body `{ avatarPreset?: string, avatarUrl?: string }`. Auth required; user can update own avatar, or parent can update any kid in their family (ownership check: `kid.parentId === getParentId(req)`).

**Component** `src/components/shared/AvatarPicker.tsx`:
- Modal: 4×6 grid of preset emoji buttons + "Upload photo" button at bottom
- Upload reuses `photosClientService.uploadPhoto(file)` — response is a `FamilyPhoto` object; extract `.url` for storage
- On select: `PUT /users/:uid/avatar`

**Avatar display priority:** `avatarUrl` → `avatarPreset` emoji → initial letter fallback

**Avatar rendered in:**
- `KidDashboard` header (replace initial circle)
- `ParentDashboard` kid list (replace initial circle)
- `TaskCard` assignee indicator
- `AgendaView` event assignee pip

**Files modified:**
- `src/server/migrations/031_add_user_avatar.sql` (new)
- `src/server/modules/users/routes.ts` — add `PUT /users/:uid/avatar`
- `src/server/modules/users/service.ts` — add `updateAvatar(uid, preset, url)`
- `src/services/users.ts` — add `updateAvatar` client method
- `src/components/shared/AvatarPicker.tsx` (new)
- `src/components/kid/KidDashboard.tsx`
- `src/components/parent/ParentDashboard.tsx`
- `src/components/kid/TaskCard.tsx`
- `src/components/calendar/AgendaView.tsx`
- `src/constants.ts`
- `src/types.ts` — add `avatarPreset?: string`, `avatarUrl?: string` to `UserProfile`

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
| `src/server/modules/invites/routes.ts` | C | Modify |
| `src/server/modules/users/routes.ts` | C,E | Modify |
| `src/server/modules/users/service.ts` | C,E | Modify |
| `src/server/modules/notifications/routes.ts` | D | Modify |
| `src/server/modules/notifications/emailService.ts` | D | New |
| `src/server/modules/notes/routes.ts` | E | New |
| `src/server/modules/notes/service.ts` | E | New |
| `src/server/middleware/auth.ts` | C | Modify |
| `src/server/socket.ts` | C | Modify |
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
| `src/services/users.ts` | E | Modify |
| `src/App.tsx` | D | Modify |
| `src/main.tsx` | D,E | Modify |
| `src/constants.ts` | E | Modify |
| `public/sw.js` | D,E | New |
| `public/manifest.json` | E | New |
| `public/icon-192.png` | E | New |
| `public/icon-512.png` | E | New |
| `.env.example` | D | Modify |
| `server.ts` | E | Modify (register notes router) |

---

## Definition of Done

- [ ] Reliability fixes: 12 remaining tasks pass tests (FK/synchronous and approval routes already done)
- [ ] Recurring events: create, display, edit (one/future), delete (one/future) all work correctly
- [ ] Monthly day-31 clamp and yearly Feb-29 resolve tested explicitly
- [ ] Clicking any event opens EventDetailModal with edit and delete
- [ ] All-day events render in pinned top strip of week/day views, stored in family timezone
- [ ] Co-parent can join via invite code, gets full parent access
- [ ] Owner can remove co-parent: account orphaned, push subscriptions deleted, socket force-logout fired, subsequent requests 401
- [ ] Tasks with `requiresApproval` show pending queue on parent dashboard
- [ ] Approve/reject updates kid dashboard in real-time via socket
- [ ] Web push notifications fire for events with `reminderMinutes` set
- [ ] Email reminders fire when SMTP configured
- [ ] No duplicate reminders sent (verified by `sent_reminders` PK constraint)
- [ ] PWA manifest present, service worker registered, app installable on Android/desktop
- [ ] Countdown chips appear in wall mode for future countdown events
- [ ] Family note persists, updates real-time across clients, read-only for kids
- [ ] Kid avatars save (preset + upload), display in dashboard and task cards
