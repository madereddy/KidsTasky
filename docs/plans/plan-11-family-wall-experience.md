# Plan 11 - Family Wall Experience (Skylight-Style)

**Group:** D (depends on existing calendar, settings, weather, and sync work)
**Blocked by:** Plan 01, Plan 03, Plan 06, Plan 08

---

## Problem

The product has core modules (calendar, lists, meals, weather, Google sync), but it does not yet behave like a reliable shared wall display for a household. The biggest gaps are:

- Sync confidence is low (`Sync Now` can fail without actionable feedback)
- Google color fidelity is inconsistent
- Calendar visibility controls are not robust for shared vs private calendars
- The wall UI does not yet provide a true family "home hub" experience

---

## Scope

Build a stable, tablet-first family wall experience with:

- Reliable sync and clear sync status
- Accurate Google calendar color/visibility behavior
- Default "family-first" display profile
- Family dashboard cards (weather, meals, tasks, upcoming strip)
- Touch-first quick-add and recurring routines

---

## Non-Goals (This Plan)

- Full mobile app rewrite
- Multi-provider calendar sync beyond Google
- Advanced AI planning/recommendation features

---

## What Already Exists

- `src/server/modules/sync/service.ts` and `src/server/worker.ts` for Google sync
- `src/server/modules/sync/routes.ts` includes manual sync endpoint
- `src/components/calendar/CalendarView.tsx` has wall toggle and source chips
- `src/components/parent/SettingsView.tsx` includes calendar sync controls
- Existing weather, meal, and list modules/components

---

## Phase A - Sync Reliability and Diagnostics

### Objective
Make sync operations reliable, observable, and user-trustworthy.

### Files to Modify

- `src/server/modules/sync/service.ts`
- `src/server/modules/sync/routes.ts`
- `src/server/worker.ts`
- `src/services/sync.ts`
- `src/components/parent/SettingsView.tsx`

### Required Changes

1. Ensure all sync calendar ID creation uses one collision-safe helper path.
2. Return structured sync-now results:
   - `successCount`
   - `failureCount`
   - `errors[]` with provider/calendar context
   - `startedAt`, `finishedAt`
3. Persist and expose `lastSyncAt` and `lastSyncStatus` per connection.
4. Add retry-once behavior for token expiration and transient 5xx API errors.
5. Add server logs with stable error keys for filtering.

### Acceptance Criteria

- [ ] `Sync Now` returns actionable failure details
- [ ] No primary-key sync calendar collisions
- [ ] Last sync timestamp/status visible in Settings
- [ ] Token refresh + retry works on expired access token

---

## Phase B - Calendar Color and Visibility Fidelity

### Objective
Mirror Google calendar semantics: what is shared should be visible; personal/private calendars stay optional.

### Files to Modify

- `src/server/worker.ts`
- `src/server/modules/events/service.ts`
- `src/server/modules/events/routes.ts`
- `src/components/calendar/CalendarView.tsx`
- `src/services/settings.ts`
- `src/types.ts`

### Required Changes

1. Preserve event color precedence:
   - Google event color (event `colorId`) first
   - Source calendar color fallback
   - Local default fallback
2. Store sync source metadata:
   - `sourceCalendarId`
   - `sourceCalendarName`
   - `isSharedCalendar` (derived from calendar access role)
3. Add persisted per-parent calendar preferences:
   - enabled/disabled by source calendar
   - wall default profile
4. Remove duplicate settings entry from Tasks surfaces everywhere.

### Acceptance Criteria

- [ ] Imported events visually match Google calendar colors
- [ ] Shared family calendar enabled by default in wall mode
- [ ] Personal calendars can be hidden without disconnecting sync
- [ ] No duplicate Settings entry appears in Tasks UI

---

## Phase C - Family Wall Dashboard UX

### Objective
Provide a "glanceable" wall screen that works from a mounted tablet.

### Files to Modify

- `src/components/calendar/CalendarView.tsx`
- `src/components/weather/WeeklyWeather.tsx`
- `src/components/lists/ListSidebar.tsx`
- `src/components/meals/*` (display-only integration points)
- `src/styles/*` (wall layout styles)

### Required Changes

1. Layout:
   - Left: agenda timeline
   - Right: weather + meals + task highlights
   - Bottom: "Next Up" strip (next 3-5 family items)
2. Add wall preset filters:
   - `Today`
   - `This Week`
   - `All Day`
3. Touch-first controls:
   - larger hit targets
   - reduced accidental taps
4. Add subtle auto-refresh and offline-safe cached state indicator.

### Acceptance Criteria

- [ ] Tablet view is readable at distance and touch-friendly
- [ ] Family-relevant cards populate from existing modules
- [ ] Wall mode launches with family-first defaults

---

## Phase D - Family Workflow Features

### Objective
Support core household routines directly from the wall.

### Files to Modify

- `src/components/calendar/CalendarView.tsx`
- `src/components/tasks/*`
- `src/server/modules/events/*`
- `src/server/modules/lists/*`

### Required Changes

1. Quick Add panel:
   - add event/task/chore from one sheet
   - default assignment and time presets
2. Recurring routine templates:
   - school pickup
   - trash day
   - activities
3. Parent approval flow for child task completion.

### Acceptance Criteria

- [ ] A family member can add an item in <=3 taps
- [ ] Recurring routines generate correctly on schedule
- [ ] Parent approval updates are real-time across clients

---

## Phase E - Rollout, Safety, and Validation

### Objective
Ship incrementally without destabilizing production behavior.

### Required Changes

1. Feature flags:
   - `wall_v2_layout`
   - `sync_diagnostics`
   - `calendar_visibility_profiles`
2. Staged enablement:
   - internal profile
   - one household pilot
   - full rollout
3. Rollback:
   - flag-off returns to prior UI/behavior without DB rollback
4. Regression test additions:
   - sync route tests for success/failure payload shape
   - worker tests for color precedence
   - UI tests for hidden/visible calendars by profile

### Acceptance Criteria

- [ ] Flagged rollout path exists for each major feature
- [ ] Rollback can be executed in one config change
- [ ] Critical user flows have regression coverage

---

## Delivery Sequence (2 Weeks)

1. **Week 1, Days 1-2:** Phase A
2. **Week 1, Days 3-4:** Phase B
3. **Week 1, Day 5 + Week 2, Day 1:** Phase C
4. **Week 2, Days 2-3:** Phase D
5. **Week 2, Days 4-5:** Phase E hardening and staged rollout

---

## Definition of Done

- [ ] Sync reliability issues are resolved with clear user-facing diagnostics
- [ ] Google calendar colors and shared/personal visibility behave correctly
- [ ] Wall mode is useful as a default household display
- [ ] Family quick-add and routine workflows are operational
- [ ] Rollout and rollback controls are in place
