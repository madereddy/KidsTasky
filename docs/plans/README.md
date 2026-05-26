# KidsTasky - Implementation Plan Overview

## Goal
Build a locally-running Skylight Calendar clone. The 11 phases below close the gap between the current codebase and full Skylight feature parity.

---

## Parallel Work Groups

### Group A - No dependencies, start immediately (all 4 in parallel)

| Plan | Feature |
|------|---------|
| [plan-01-calendar-views.md](./plan-01-calendar-views.md) | Functional calendar (Month/Week/Day/Agenda views) |
| [plan-03-settings-ui.md](./plan-03-settings-ui.md) | Family settings UI (location, timezone, PIN, sleep hours) |
| [plan-05-shared-lists.md](./plan-05-shared-lists.md) | Shared lists UI (grocery, to-do, packing) |
| [plan-10-stars-allowance.md](./plan-10-stars-allowance.md) | Star rewards + allowance tracking |

### Group B - Requires Plan 01 (calendar must exist)

| Plan | Feature | Blocked by |
|------|---------|------------|
| [plan-02-member-colors.md](./plan-02-member-colors.md) | Per-member color coding + event filtering | Plan 01 |
| [plan-04-meal-planning.md](./plan-04-meal-planning.md) | Meal planning UI + recipe library | Plan 01 |
| [plan-08-google-sync.md](./plan-08-google-sync.md) | Bidirectional Google Calendar sync | Plan 01 |

### Group C - Requires Plan 03 (settings must exist)

| Plan | Feature | Blocked by |
|------|---------|------------|
| [plan-06-weather.md](./plan-06-weather.md) | Weather on calendar events | Plan 01 + Plan 03 |
| [plan-07-photo-upload.md](./plan-07-photo-upload.md) | Photo upload UI + captions | Plan 03 |
| [plan-09-parental-lock.md](./plan-09-parental-lock.md) | Parental lock mode | Plan 03 |

### Group D - Requires Calendar + Settings + Sync + Weather foundations

| Plan | Feature | Blocked by |
|------|---------|------------|
| [plan-11-family-wall-experience.md](./plan-11-family-wall-experience.md) | Skylight-style family wall display, sync trust, color fidelity, quick-add flows | Plan 01 + Plan 03 + Plan 06 + Plan 08 |

---

## Dependency Graph

```
Plan 01 (Calendar)  --> Plan 02 (Member Colors)
                   --> Plan 04 (Meal Planning)
                   --> Plan 08 (Google Sync)
                   --> Plan 06 (Weather) <-- Plan 03 (Settings)

Plan 03 (Settings)  --> Plan 06 (Weather)
                   --> Plan 07 (Photos)
                   --> Plan 09 (Parental Lock)

Plan 05 (Lists)     -- standalone
Plan 10 (Stars)     -- standalone
Plan 11 (Family Wall) <-- Plan 01 + Plan 03 + Plan 06 + Plan 08
```

---

## Recommended Execution Order

**Sprint 1** - Work Plans 01, 03, 05, 10 in parallel.

**Sprint 2** - Once Plan 01 is done: start Plans 02, 04, 08.
Once Plan 03 is done: start Plans 07, 09.

**Sprint 3** - Once both Plan 01 and Plan 03 are done: start Plan 06.

**Sprint 4** - Once Plans 01, 03, 06, and 08 are done: start Plan 11.

---

## What Already Exists (Do Not Rebuild)

- Express backend with JWT auth middleware
- SQLite DB with 13 migrations (all domain schemas present)
- Socket.io real-time sync infrastructure
- `eventsClientService` - `getEvents`, `createEvent`
- `weatherService` - Open-Meteo API wrapper + `GET /weather` route
- `listsService` - `getLists`, `getListItems` (reads only)
- `mealsService` - `getRecipes`, `getMealPlans` (reads only)
- `photosService` - `addPhoto` (mocked upload route)
- `CalendarMonthView.tsx` - placeholder to replace, not delete
- `WeeklyWeather.tsx` - working display component, needs wiring
- `ListSidebar.tsx` - working display component, needs wiring
- `PhotoScreensaver.tsx` - working screensaver, needs real photo data
- `PinPad.tsx` - reuse in parental lock overlay
- Google OAuth sync (import-only, needs push added)
- XP/badge/streak gamification engine (stars layer on top, don't replace)
