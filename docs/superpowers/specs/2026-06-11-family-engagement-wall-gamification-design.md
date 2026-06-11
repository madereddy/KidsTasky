# Spec: Family Engagement — Wall-First Gravity & Gamification Escalation

**Date:** 2026-06-11
**Status:** Draft
**Topic:** Increase day-to-day family engagement by making the wall tablet the compelling family command center and deepening the gamification loop so kids self-motivate and pull parents in.

---

## 1. Problem

KidsTasky is feature-rich but new to this family. Neither kids nor parents have formed a habit of opening it. The wall tablet is the primary surface (phones not yet set up). The app needs:
- **Gravity** — reasons to walk up and interact, not just glance
- **Self-motivation** — kids want to open it without being told
- **Ambient value** — the wall earns its place by always showing something useful

Phone-based notifications are out of scope (Phase 2, once phones are set up).

---

## 2. Goals & Success Criteria

- Family members naturally check the wall display at least once per time-of-day segment
- Kids proactively complete missions to protect streaks and compete on the leaderboard
- Parents are pulled in by kids asking for missions / checking scores
- Wall is visually compelling enough that it replaces looking at phones for family scheduling info

---

## 3. Feature 1: Time-Aware Wall View Modes

The wall display auto-shifts between 5 modes based on time of day. No taps needed — the display always shows the most relevant information for the current moment.

### 3.1 Mode Definitions

| Mode | Time Window | Primary Focus |
|------|-------------|---------------|
| **Morning Briefing** | 6:00–9:00 AM | Today's missions per kid, today's meals, weather, next calendar event |
| **Ambient** | 9:00 AM–3:00 PM | Photo screensaver + live family activity ticker (completed missions, calendar changes) |
| **After School** | 3:00–6:00 PM | Kid missions front-and-center, XP progress bars, Power Mission CTA |
| **Evening Wind-Down** | 6:00–9:00 PM | Dinner meal card + "Missing Ingredients?" CTA, tomorrow's preview, family XP recap |
| **Night** | 9:00 PM–6:00 AM | Clock + tomorrow's weather, dimmed display |

### 3.2 Implementation

- Mode selection logic lives in `useWallHomeController` as a `getCurrentWallMode(now: Date): WallMode` helper
- `WallMode` is a discriminated union; each mode carries the data it needs
- Time windows are fixed constants (no user config in v1)
- The wall display component switches layout based on `mode` — no nested `if/else` sprawl, each mode is its own layout component
- Ambient mode reuses existing photo screensaver; activity ticker is a new component fed from Socket.IO `staleData` events

### 3.3 Interactive Gravity Points (across all non-night modes)

These elements appear in relevant modes and are tappable:

- **XP progress bars** — animated fill; visual progress begs to be completed
- **Meal card** — shows tonight's dinner with "Missing Ingredients?" button (cross-references shopping list, bulk-adds missing items)
- **Event countdown ticker** — "Soccer in 2h 15m", updates live
- **Grocery chips row** — horizontal scroll of top-5 frequent items not currently on shopping list; one tap adds to list

---

## 4. Feature 2: Gamification Escalation

### 4.1 Daily Streak System

- Each kid has a `current_streak` and `longest_streak` counter
- Streak increments when kid completes ≥1 mission on a calendar day
- Streak resets to 0 if a full day passes with no completions
- **Display:** Streak shown as fire icon + count on kid's profile card on the wall. Streak breaking is visually salient (fire goes out, grey counter).
- **XP multiplier:** Completing any mission while on a streak of 3+ days applies a 1.5x XP multiplier. Streak of 7+ days: 2x multiplier. Shown on mission completion animation.
- **DB:** Add `current_streak`, `longest_streak`, `last_mission_date` columns to `users` table. Worker cron resets streaks at midnight for users with no completions that day.

### 4.2 Family Leaderboard

- Weekly XP totals per family member, reset every Monday at midnight
- Parents earn XP by assigning missions (5 XP) and marking them reviewed/approved (10 XP)
- Displayed on wall in After School and Evening modes as a ranked list with deltas from last week
- **DB:** No new table needed — query `task_completions` by `parentId` + date range

### 4.3 Power Mission

- One rotating "Power Mission" per family per day: 2x XP, marked with a bolt icon ⚡
- Selected by parent (or auto-selected: highest-priority pending task across all kids)
- Expires at midnight — creates urgency and a daily check-in reason
- Displayed prominently in Morning Briefing and After School modes
- **DB:** `power_mission_id` and `power_mission_date` columns on `families` (or equivalent parent record); cron clears at midnight

### 4.4 Animated XP Celebrations

- When a kid completes a mission, the wall display shows a full-screen burst animation: confetti + XP number flying up + kid's name
- Triggered via Socket.IO event `missionCompleted` — wall listens and plays animation regardless of which device completed the mission
- Animation duration: ~2.5s, then returns to current mode
- Uses existing Motion library

### 4.5 Achievement Badges

Milestone badges displayed on kid's profile card on the wall:

| Badge | Trigger |
|-------|---------|
| 🔥 Streak Starter | 3-day streak |
| 🔥🔥 On Fire | 7-day streak |
| ⭐ Century | 100 missions completed |
| 🏆 Family MVP | Highest XP in family for the week |
| 🚀 Power Chaser | Completed 5 Power Missions |

- Badges stored as JSON array in `users.badges` column
- Evaluated by worker cron nightly + on mission completion
- Wall displays most recent 3 badges per kid

---

## 5. Data Model Changes

| Table | Change |
|-------|--------|
| `users` | Add `current_streak INT DEFAULT 0`, `longest_streak INT DEFAULT 0`, `last_mission_date TEXT`, `badges TEXT DEFAULT '[]'` |
| `families` / parent record | Add `power_mission_id INT`, `power_mission_date TEXT` |

Migration: new numbered SQL file in `src/server/migrations/`.

---

## 6. Architecture Notes

- `useWallHomeController` owns mode switching and feeds all wall layout components
- New `useStreakService` (server-side) handles streak calculation — pure functions, easy to unit test
- `useMissionTodayController` gets `streakData` and `powerMission` injected
- Socket.IO event `missionCompleted` carries `{ userId, xp, streakDay, badgesEarned[] }` — wall subscribes for celebration animation trigger
- Worker cron adds: midnight streak reset, midnight Power Mission rotation, weekly leaderboard reset (Monday)

---

## 7. Out of Scope (Phase 2)

- Push notifications to phones
- PWA install flow
- Configurable time window overrides
- Parent-facing streak analytics

---

## 8. Testing Strategy

- **Unit:** `getCurrentWallMode(date)` across all time boundaries and edge cases (midnight, DST)
- **Unit:** streak calculation logic (increment, reset, multiplier thresholds)
- **Integration:** Power Mission assignment + expiry via worker cron
- **Integration:** `missionCompleted` Socket.IO event triggers celebration on wall client
- **Visual:** Wall layout in each of the 5 modes at representative screen sizes
