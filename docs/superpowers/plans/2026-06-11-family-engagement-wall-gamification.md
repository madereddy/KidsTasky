# Family Engagement — Wall-First Gravity & Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wall tablet the family's daily command center by adding time-aware display modes, streak/XP gamification, a daily Power Mission, family leaderboard, and animated celebration on mission completion.

**Architecture:** Backend adds an `xp_events` log table and new columns on `users` for streak/power-mission tracking; a pure `streakService` module handles all streak/badge/XP logic. A new `mission-completed` Socket.IO event drives wall-side XP celebrations. The frontend `useWallHomeController` gains a `wallMode` computed from time-of-day and fetches leaderboard/streak/power-mission data; new focused components (XpCelebration, FamilyLeaderboard, PowerMissionCard, GroceryChips) render into `WallHome` based on active mode.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, Socket.IO, React 19, Motion (animations), Tailwind CSS v4, Vitest

**Spec:** `docs/superpowers/specs/2026-06-11-family-engagement-wall-gamification-design.md`

---

## File Map

**New files:**
- `src/server/migrations/052_add_engagement_columns.sql` — adds columns to `users`, creates `xp_events` table
- `src/server/modules/tasks/streakService.ts` — pure functions: streak calc, multiplier, badge eval, xp event write
- `src/server/modules/tasks/streakService.test.ts` — unit tests for all pure functions
- `src/lib/wallMode.ts` — pure `getCurrentWallMode(now)` function
- `src/lib/wallMode.test.ts` — unit tests for time boundary logic
- `src/components/parent/XpCelebration.tsx` — full-screen burst animation triggered by socket event
- `src/components/parent/FamilyLeaderboard.tsx` — weekly XP ranked list
- `src/components/parent/PowerMissionCard.tsx` — daily 2× XP Power Mission slot
- `src/components/parent/GroceryChips.tsx` — horizontal scroll, one-tap add frequent items

**Modified files:**
- `src/types.ts` — add `WallMode`, `StreakData`, `XpEvent`, `LeaderboardEntry`, `PowerMission` types
- `src/server/modules/tasks/service.ts` — `createCompletion` calls streakService, writes `xp_events`; `createTask` + approval write parent `xp_events`
- `src/server/modules/tasks/routes.ts` — emit `mission-completed` socket event after completion
- `src/server/modules/tasks/service.test.ts` — extend existing tests
- `src/server/socket.ts` — add `emitToFamily(parentId, event, data)` helper
- `src/server/worker.ts` — add midnight crons: streak reset, Power Mission selection, Monday leaderboard marker
- `src/hooks/useWallHomeController.ts` — add `wallMode`, `streakData`, `powerMission`, `leaderboard`, socket listener for `mission-completed`
- `src/components/parent/WallHome.tsx` — wire time-aware layout, new components per mode

---

## Task 1: DB Migration

**Files:**
- Create: `src/server/migrations/052_add_engagement_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- src/server/migrations/052_add_engagement_columns.sql
ALTER TABLE users ADD COLUMN longestStreak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN lastMissionDate TEXT;
ALTER TABLE users ADD COLUMN powerMissionId TEXT;
ALTER TABLE users ADD COLUMN powerMissionDate TEXT;

CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  parentId TEXT NOT NULL,
  xp INTEGER NOT NULL,
  reason TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_xp_events_parentId_createdAt ON xp_events(parentId, createdAt);

UPDATE schema_version SET version = 52;
```

- [ ] **Step 2: Verify migration runs**

```bash
pnpm vitest run src/server/migrations.test.ts
```
Expected: all migration tests pass (confirms SQL is valid and idempotent)

- [ ] **Step 3: Commit**

```bash
git add src/server/migrations/052_add_engagement_columns.sql
git commit -m "feat(db): add engagement columns and xp_events table"
```

---

## Task 2: Add New Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add types**

Add to `src/types.ts`:

```typescript
export type WallMode = 'morning' | 'ambient' | 'afterschool' | 'evening' | 'night';

export interface StreakData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  multiplier: number; // 1 | 1.5 | 2
  badgesEarned: string[]; // badge keys e.g. 'streak_3', 'century'
}

export interface XpEvent {
  id: number;
  userId: string;
  parentId: string;
  xp: number;
  reason: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  weeklyXp: number;
  deltaFromLastWeek: number;
  role: 'parent' | 'kid' | 'coparent';
}

export interface PowerMission {
  taskId: string;
  title: string;
  xpReward: number;
  assignedKidId: string;
  assignedKidName: string;
}

export interface MissionCompletedPayload {
  userId: string;
  xp: number;
  streakDay: number;
  badgesEarned: string[];
}
```

- [ ] **Step 2: Verify no type errors**

```bash
pnpm lint
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add WallMode, StreakData, LeaderboardEntry, PowerMission, MissionCompletedPayload"
```

---

## Task 3: streakService — Pure Functions + Tests

**Files:**
- Create: `src/server/modules/tasks/streakService.ts`
- Create: `src/server/modules/tasks/streakService.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/server/modules/tasks/streakService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateStreakUpdate,
  getXpMultiplier,
  evaluateBadges,
} from './streakService.js';

describe('calculateStreakUpdate', () => {
  it('increments streak when completing on next day', () => {
    const result = calculateStreakUpdate('2026-06-10', '2026-06-11', 3, 3);
    expect(result.newStreak).toBe(4);
    expect(result.newLongest).toBe(4);
  });

  it('keeps streak at 1 when completing same day', () => {
    const result = calculateStreakUpdate('2026-06-11', '2026-06-11', 2, 2);
    expect(result.newStreak).toBe(2); // no change — already counted today
  });

  it('resets streak to 1 when gap > 1 day', () => {
    const result = calculateStreakUpdate('2026-06-09', '2026-06-11', 5, 5);
    expect(result.newStreak).toBe(1);
    expect(result.newLongest).toBe(5); // longest preserved
  });

  it('starts streak at 1 when lastMissionDate is null', () => {
    const result = calculateStreakUpdate(null, '2026-06-11', 0, 0);
    expect(result.newStreak).toBe(1);
    expect(result.newLongest).toBe(1);
  });
});

describe('getXpMultiplier', () => {
  it('returns 1 for streak below 3', () => expect(getXpMultiplier(2)).toBe(1));
  it('returns 1.5 for streak 3–6', () => expect(getXpMultiplier(3)).toBe(1.5));
  it('returns 2 for streak 7+', () => expect(getXpMultiplier(7)).toBe(2));
});

describe('evaluateBadges', () => {
  it('awards streak_3 at streak 3', () => {
    expect(evaluateBadges({ streak: 3, completions: 0, powerMissions: 0, isFamilyMvp: false }))
      .toContain('streak_3');
  });
  it('awards on_fire at streak 7', () => {
    expect(evaluateBadges({ streak: 7, completions: 0, powerMissions: 0, isFamilyMvp: false }))
      .toContain('on_fire');
  });
  it('awards century at 100 completions', () => {
    expect(evaluateBadges({ streak: 0, completions: 100, powerMissions: 0, isFamilyMvp: false }))
      .toContain('century');
  });
  it('awards power_chaser at 5 power missions', () => {
    expect(evaluateBadges({ streak: 0, completions: 0, powerMissions: 5, isFamilyMvp: false }))
      .toContain('power_chaser');
  });
  it('awards family_mvp when isFamilyMvp is true', () => {
    expect(evaluateBadges({ streak: 0, completions: 0, powerMissions: 0, isFamilyMvp: true }))
      .toContain('family_mvp');
  });
  it('returns empty array when no thresholds met', () => {
    expect(evaluateBadges({ streak: 1, completions: 5, powerMissions: 0, isFamilyMvp: false }))
      .toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm vitest run src/server/modules/tasks/streakService.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement streakService**

Create `src/server/modules/tasks/streakService.ts`:

```typescript
import { db } from '../../db.js';

interface StreakUpdateResult {
  newStreak: number;
  newLongest: number;
}

// Returns updated streak values given the last mission date and today's date string (YYYY-MM-DD).
// "Same day" completions don't increment the streak — streak increments once per calendar day.
export function calculateStreakUpdate(
  lastMissionDate: string | null,
  today: string,
  currentStreak: number,
  longestStreak: number
): StreakUpdateResult {
  if (!lastMissionDate) {
    return { newStreak: 1, newLongest: Math.max(longestStreak, 1) };
  }
  if (lastMissionDate === today) {
    return { newStreak: currentStreak, newLongest: longestStreak };
  }
  const last = new Date(lastMissionDate);
  const todayDate = new Date(today);
  const diffDays = Math.round((todayDate.getTime() - last.getTime()) / 86400000);
  if (diffDays === 1) {
    const newStreak = currentStreak + 1;
    return { newStreak, newLongest: Math.max(longestStreak, newStreak) };
  }
  // Gap > 1 day — streak broken
  return { newStreak: 1, newLongest: longestStreak };
}

export function getXpMultiplier(streak: number): number {
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

interface BadgeInput {
  streak: number;
  completions: number;
  powerMissions: number;
  isFamilyMvp: boolean;
}

// Returns badge keys newly earned based on current stats.
// Caller should diff against existing badges to find truly new ones.
export function evaluateBadges(input: BadgeInput): string[] {
  const earned: string[] = [];
  if (input.streak >= 3) earned.push('streak_3');
  if (input.streak >= 7) earned.push('on_fire');
  if (input.completions >= 100) earned.push('century');
  if (input.powerMissions >= 5) earned.push('power_chaser');
  if (input.isFamilyMvp) earned.push('family_mvp');
  return earned;
}

export function writeXpEvent(userId: string, parentId: string, xp: number, reason: string): void {
  db.prepare(
    'INSERT INTO xp_events (userId, parentId, xp, reason, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, parentId, xp, reason, new Date().toISOString());
}

export function getWeeklyXp(parentId: string, weekStart: string, weekEnd: string): Array<{ userId: string; totalXp: number }> {
  return db.prepare(`
    SELECT userId, SUM(xp) AS totalXp
    FROM xp_events
    WHERE parentId = ? AND createdAt >= ? AND createdAt < ?
    GROUP BY userId
    ORDER BY totalXp DESC
  `).all(parentId, weekStart, weekEnd) as Array<{ userId: string; totalXp: number }>;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm vitest run src/server/modules/tasks/streakService.test.ts
```
Expected: all 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/tasks/streakService.ts src/server/modules/tasks/streakService.test.ts
git commit -m "feat(tasks): add streakService with streak calc, XP multiplier, badge eval"
```

---

## Task 4: Integrate Streak + XP Events into createCompletion

**Files:**
- Modify: `src/server/modules/tasks/service.ts`
- Modify: `src/server/modules/tasks/service.test.ts`

- [ ] **Step 1: Read current createCompletion to understand what it returns**

Read `src/server/modules/tasks/service.ts` lines around `createCompletion` (near line 101).

- [ ] **Step 2: Write a failing test for the new return shape**

Add to `src/server/modules/tasks/service.test.ts` (follow the existing `beforeEach` setup in that file which uses `parentId = 'tx_test_parent'`, `kid1 = 'tx_test_kid1'`, `taskId = 'tx_test_task'`):

```typescript
it('createCompletion returns streakDay and badgesEarned and writes xp_events row', () => {
  db.prepare('DELETE FROM xp_events WHERE userId = ?').run(kid1);
  const result = taskServiceServer.createCompletion({ taskId, kidId: kid1, dateString: '2026-06-11' });
  expect(result).toHaveProperty('streakDay');
  expect(result.streakDay).toBeGreaterThanOrEqual(1);
  expect(result).toHaveProperty('badgesEarned');
  expect(Array.isArray(result.badgesEarned)).toBe(true);
  const events = db.prepare('SELECT * FROM xp_events WHERE userId = ?').all(kid1) as any[];
  expect(events.length).toBeGreaterThan(0);
  expect(events[0].reason).toBe('mission_completion');
});

it('createCompletion returns taskId and xpEarned', () => {
  const result = taskServiceServer.createCompletion({ taskId, kidId: kid1, dateString: '2026-06-12' });
  expect(result).toHaveProperty('taskId', taskId);
  expect(result).toHaveProperty('xpEarned');
  expect(typeof result.xpEarned).toBe('number');
});
```

- [ ] **Step 3: Run test — confirm it fails**

```bash
pnpm vitest run src/server/modules/tasks/service.test.ts -t "createCompletion returns streakDay"
```
Expected: FAIL

- [ ] **Step 4: Modify createCompletion**

In `src/server/modules/tasks/service.ts`, after the `adjustUserXp` call inside `createCompletion`:

1. Import at top of file:
```typescript
import { calculateStreakUpdate, getXpMultiplier, evaluateBadges, writeXpEvent } from './streakService.js';
```

2. Inside the transaction, after `adjustUserXp`, add:
```typescript
// Streak update
const today = new Date().toISOString().slice(0, 10);
const kidUser = db.prepare('SELECT currentStreak, longestStreak, lastMissionDate, badges FROM users WHERE uid = ?').get(data.kidId) as { currentStreak: number; longestStreak: number; lastMissionDate: string | null; badges: string } | undefined;
const existingStreak = kidUser?.currentStreak ?? 0;
const existingLongest = kidUser?.longestStreak ?? 0;
const { newStreak, newLongest } = calculateStreakUpdate(kidUser?.lastMissionDate ?? null, today, existingStreak, existingLongest);
db.prepare('UPDATE users SET currentStreak = ?, longestStreak = ?, lastMissionDate = ? WHERE uid = ?')
  .run(newStreak, newLongest, today, data.kidId);

// XP event log
const baseXp = xpForDifficulty(task?.difficulty);
const multiplier = getXpMultiplier(newStreak);
const finalXp = Math.round(baseXp * multiplier);
// Adjust XP to account for the multiplier (adjustUserXp already ran with baseXp)
if (multiplier > 1) adjustUserXp(data.kidId, finalXp - baseXp);
writeXpEvent(data.kidId, task?.parentId ?? '', finalXp, 'mission_completion');

// Badge evaluation
const completionCount = (db.prepare('SELECT COUNT(*) AS c FROM task_completions WHERE kidId = ?').get(data.kidId) as { c: number }).c;
const powerMissionCount = (db.prepare("SELECT COUNT(*) AS c FROM xp_events WHERE userId = ? AND reason = 'power_mission'").get(data.kidId) as { c: number }).c;
const existingBadges: string[] = JSON.parse(kidUser?.badges ?? '[]');
const allEarned = evaluateBadges({ streak: newStreak, completions: completionCount, powerMissions: powerMissionCount, isFamilyMvp: false });
const newBadges = allEarned.filter(b => !existingBadges.includes(b));
if (newBadges.length > 0) {
  const updatedBadges = [...existingBadges, ...newBadges];
  db.prepare('UPDATE users SET badges = ? WHERE uid = ?').run(JSON.stringify(updatedBadges), data.kidId);
}
```

3. In the return value of `createCompletion`, add:
```typescript
streakDay: newStreak,
badgesEarned: newBadges,
xpEarned: finalXp,   // total XP including streak multiplier
taskId: task?.id,    // needed by the route to look up parentId for socket emission
```
Ensure these are added to whatever object `createCompletion` currently returns (look for the `return { ... }` at the end of the transaction).

- [ ] **Step 5: Run tests — confirm they pass**

```bash
pnpm vitest run src/server/modules/tasks/service.test.ts
```
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/tasks/service.ts src/server/modules/tasks/service.test.ts
git commit -m "feat(tasks): integrate streak tracking and xp_events into createCompletion"
```

---

## Task 5: Parent XP Events on Task Assignment and Approval

**Files:**
- Modify: `src/server/modules/tasks/service.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/server/modules/tasks/service.test.ts` (reuses `parentId`, `kid1` from the existing `beforeEach`):

```typescript
it('createTask with assignedTo writes xp_event for parent', () => {
  db.prepare('DELETE FROM xp_events WHERE userId = ?').run(parentId);
  taskServiceServer.createTask({
    title: 'XP test task',
    assignedTo: kid1,
    parentId,
    frequency: 'daily',
    starValue: 2,
    requiresApproval: false,
  });
  const events = db.prepare('SELECT * FROM xp_events WHERE userId = ?').all(parentId) as any[];
  expect(events.length).toBe(1);
  expect(events[0].reason).toBe('task_assigned');
  expect(events[0].xp).toBe(5);
});

it('approving a completion writes xp_event for parent', () => {
  db.prepare('DELETE FROM xp_events WHERE userId = ?').run(parentId);
  const approvalTaskId = 'xp_approval_task';
  db.prepare("INSERT OR REPLACE INTO tasks (id, title, frequency, assignedKidId, parentId, status, createdAt, starValue, requiresApproval) VALUES (?, 'Approval Task', 'daily', ?, ?, 'active', ?, 5, 1)")
    .run(approvalTaskId, kid1, parentId, Date.now());
  const completion = taskServiceServer.createCompletion({ taskId: approvalTaskId, kidId: kid1, dateString: '2026-06-11' });
  taskServiceServer.approveCompletion(completion.id, parentId);
  const events = db.prepare('SELECT * FROM xp_events WHERE userId = ? AND reason = ?').all(parentId, 'task_approved') as any[];
  expect(events.length).toBe(1);
  expect(events[0].xp).toBe(10);
});
```

> **Note:** `approveCompletion` may be named differently — check `service.ts` for the function that transitions a completion to approved status.

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm vitest run src/server/modules/tasks/service.test.ts -t "writes xp_event for parent"
```

- [ ] **Step 3: Add XP event writes**

In `createTask` (find where task is inserted), add after insert when `assignedTo` is set:
```typescript
if (data.assignedTo) {
  writeXpEvent(parentId, parentId, 5, 'task_assigned');
}
```

In the approval/mark-reviewed path (find where task is approved), add:
```typescript
writeXpEvent(parentUserId, parentUserId, 10, 'task_approved');
```

> **Note:** `parentUserId` is the parent's `uid` — same as `parentId` for the root parent role.

- [ ] **Step 4: Run tests — confirm pass**

```bash
pnpm vitest run src/server/modules/tasks/service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/tasks/service.ts src/server/modules/tasks/service.test.ts
git commit -m "feat(tasks): write xp_events for parent on task assignment and approval"
```

---

## Task 6: Socket — emitToFamily + mission-completed Event

**Files:**
- Modify: `src/server/socket.ts`
- Modify: `src/server/modules/tasks/routes.ts`

- [ ] **Step 1: Add emitToFamily to socket wrapper**

In `src/server/socket.ts`, inside the `socketWrapper` object after `emitStaleData`:

```typescript
emitToFamily: (parentId: string, event: string, data: unknown) => {
  if (!io) return;
  io.to(parentId).emit(event, data);
},
```

- [ ] **Step 2: Emit mission-completed in tasks routes**

In `src/server/modules/tasks/routes.ts`, find the `POST /completions` handler. After the `createCompletion` call and before the `res.json(...)`, add:

```typescript
const { streakDay, badgesEarned, xpEarned, taskId: completedTaskId } = result;
// result.xpEarned and result.taskId were added to createCompletion's return in Task 4
const completedTask = taskServiceServer.getTaskById(completedTaskId);
socketWrapper.emitToFamily(completedTask?.parentId ?? '', 'mission-completed', {
  userId: result.kidId,
  xp: xpEarned,
  streakDay,
  badgesEarned,
} satisfies import('../../../types.js').MissionCompletedPayload);
```

- [ ] **Step 3: Verify no TS errors**

```bash
pnpm lint
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/server/socket.ts src/server/modules/tasks/routes.ts
git commit -m "feat(socket): add emitToFamily and emit mission-completed event on task completion"
```

---

## Task 7: Leaderboard + Power Mission API Endpoints

**Files:**
- Modify: `src/server/modules/tasks/routes.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/server/modules/tasks/approval.test.ts` (or a new `leaderboard.test.ts`):

```typescript
it('GET /leaderboard returns weekly XP ranked list', async () => {
  // setup parent, kid, write some xp_events
  const res = await request(app)
    .get(`/parents/${parentId}/leaderboard`)
    .set('Authorization', `Bearer ${parentToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body[0]).toHaveProperty('weeklyXp');
  expect(res.body[0]).toHaveProperty('deltaFromLastWeek');
});

it('GET /power-mission returns null when no tasks exist', async () => {
  const res = await request(app)
    .get(`/parents/${parentId}/power-mission`)
    .set('Authorization', `Bearer ${parentToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toBeNull();
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm vitest run src/server/modules/tasks/approval.test.ts -t "leaderboard"
```

- [ ] **Step 3: Add endpoints to tasks routes**

In `src/server/modules/tasks/routes.ts`, add:

```typescript
// GET /parents/:parentId/leaderboard
tasksRouter.get('/parents/:parentId/leaderboard', authenticateUser, assertParentScope, (req, res) => {
  try {
    const parentId = req.params.parentId as string;
    const now = new Date();
    // Current week: Monday 00:00 to next Monday 00:00
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Last week
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);

    const members = db.prepare("SELECT uid, name, role FROM users WHERE (uid = ? OR parentId = ?) AND role IN ('parent','kid','coparent')")
      .all(parentId, parentId) as Array<{ uid: string; name: string; role: string }>;

    const currentXp = getWeeklyXp(parentId, weekStart.toISOString(), weekEnd.toISOString());
    const lastXp = getWeeklyXp(parentId, lastWeekStart.toISOString(), lastWeekEnd.toISOString());

    const xpMap = Object.fromEntries(currentXp.map(r => [r.userId, r.totalXp]));
    const lastMap = Object.fromEntries(lastXp.map(r => [r.userId, r.totalXp]));

    const entries: import('../../../types.js').LeaderboardEntry[] = members
      .map(m => ({
        userId: m.uid,
        name: m.name,
        weeklyXp: xpMap[m.uid] ?? 0,
        deltaFromLastWeek: (xpMap[m.uid] ?? 0) - (lastMap[m.uid] ?? 0),
        role: m.role as 'parent' | 'kid' | 'coparent',
      }))
      .sort((a, b) => b.weeklyXp - a.weeklyXp);

    res.json(entries);
  } catch (error: any) {
    logger.error({ error: error.message }, 'leaderboard_error');
    res.status(500).json({ error: error.message });
  }
});

// GET /parents/:parentId/power-mission
tasksRouter.get('/parents/:parentId/power-mission', authenticateUser, assertParentScope, (req, res) => {
  try {
    const parentId = req.params.parentId as string;
    const parent = db.prepare('SELECT powerMissionId, powerMissionDate FROM users WHERE uid = ?').get(parentId) as { powerMissionId: string | null; powerMissionDate: string | null } | undefined;
    const today = new Date().toISOString().slice(0, 10);
    if (!parent?.powerMissionId || parent.powerMissionDate !== today) {
      return res.json(null);
    }
    const task = taskServiceServer.getTaskById(parent.powerMissionId);
    if (!task) return res.json(null);
    const kid = db.prepare('SELECT name FROM users WHERE uid = ?').get(task.assignedTo ?? '') as { name: string } | undefined;
    res.json({
      taskId: task.id,
      title: task.title,
      xpReward: task.xpReward ?? 0,
      assignedKidId: task.assignedTo ?? '',
      assignedKidName: kid?.name ?? '',
    } satisfies import('../../../types.js').PowerMission);
  } catch (error: any) {
    logger.error({ error: error.message }, 'power_mission_error');
    res.status(500).json({ error: error.message });
  }
});
```

> Also add `import { getWeeklyXp } from './streakService.js'` and `import { db } from '../../db.js'` at the top if not already present.

- [ ] **Step 4: Run tests — confirm pass**

```bash
pnpm vitest run src/server/modules/tasks/approval.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/tasks/routes.ts
git commit -m "feat(tasks): add /leaderboard and /power-mission API endpoints"
```

---

## Task 8: Worker — Midnight Streak Reset + Power Mission + Leaderboard

**Files:**
- Modify: `src/server/worker.ts`

- [ ] **Step 1: Read worker.ts to understand existing cron setup**

Look for how existing cron jobs are wired (search for `setInterval` or `cron` or `schedule` patterns in the file).

- [ ] **Step 2: Add midnight streak reset cron**

Add a function and schedule it to run at midnight:

```typescript
async function midnightEngagementReset() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. Reset streaks for kids who had no mission completions yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    
    // Kids whose lastMissionDate is not yesterday AND not today (streak broken)
    db.prepare(`
      UPDATE users 
      SET currentStreak = 0 
      WHERE role = 'kid' 
        AND currentStreak > 0 
        AND (lastMissionDate IS NULL OR lastMissionDate < ?)
    `).run(yesterdayStr);

    // 2. Select Power Mission for each family (parent)
    const parents = db.prepare("SELECT uid FROM users WHERE role = 'parent'").all() as { uid: string }[];
    for (const parent of parents) {
      const task = db.prepare(`
        SELECT t.id FROM tasks t
        WHERE t.parentId = ?
          AND t.status = 'pending'
          AND t.assignedTo IS NOT NULL
        ORDER BY COALESCE(t.xpReward, 0) DESC, t.createdAt ASC
        LIMIT 1
      `).get(parent.uid) as { id: string } | undefined;

      db.prepare('UPDATE users SET powerMissionId = ?, powerMissionDate = ? WHERE uid = ?')
        .run(task?.id ?? null, today, parent.uid);
    }

    logger.info('midnight_engagement_reset_complete');
  } catch (err: any) {
    logger.error({ error: err.message }, 'midnight_engagement_reset_error');
  }
}
```

The worker uses `node-cron`. Add to the worker's initialization function alongside the existing `cronHandles.push(...)` calls:

```typescript
// Run at 00:01 every day (1 minute after midnight)
cronHandles.push(cron.schedule('1 0 * * *', midnightEngagementReset));
```

- [ ] **Step 3: Verify worker still builds**

```bash
pnpm lint
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/server/worker.ts
git commit -m "feat(worker): add midnight streak reset and power mission selection cron"
```

---

## Task 9: Wall Mode Pure Function + Tests

**Files:**
- Create: `src/lib/wallMode.ts`
- Create: `src/lib/wallMode.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/wallMode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getCurrentWallMode } from './wallMode.js';

const at = (hour: number, minute = 0) => {
  const d = new Date(2026, 0, 1); // fixed date, only time matters
  d.setHours(hour, minute, 0, 0);
  return d;
};

describe('getCurrentWallMode', () => {
  it('returns morning at 6:00', () => expect(getCurrentWallMode(at(6))).toBe('morning'));
  it('returns morning at 8:59', () => expect(getCurrentWallMode(at(8, 59))).toBe('morning'));
  it('returns ambient at 9:00', () => expect(getCurrentWallMode(at(9))).toBe('ambient'));
  it('returns ambient at 14:59', () => expect(getCurrentWallMode(at(14, 59))).toBe('ambient'));
  it('returns afterschool at 15:00', () => expect(getCurrentWallMode(at(15))).toBe('afterschool'));
  it('returns afterschool at 17:59', () => expect(getCurrentWallMode(at(17, 59))).toBe('afterschool'));
  it('returns evening at 18:00', () => expect(getCurrentWallMode(at(18))).toBe('evening'));
  it('returns evening at 20:59', () => expect(getCurrentWallMode(at(20, 59))).toBe('evening'));
  it('returns night at 21:00', () => expect(getCurrentWallMode(at(21))).toBe('night'));
  it('returns night at 5:59', () => expect(getCurrentWallMode(at(5, 59))).toBe('night'));
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm vitest run src/lib/wallMode.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/wallMode.ts`:

```typescript
import type { WallMode } from '../types.js';

// Returns the wall display mode based on time of day.
// Times: morning 6–9, ambient 9–15, afterschool 15–18, evening 18–21, night 21–6
export function getCurrentWallMode(now: Date = new Date()): WallMode {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;

  if (totalMinutes >= 6 * 60 && totalMinutes < 9 * 60) return 'morning';
  if (totalMinutes >= 9 * 60 && totalMinutes < 15 * 60) return 'ambient';
  if (totalMinutes >= 15 * 60 && totalMinutes < 18 * 60) return 'afterschool';
  if (totalMinutes >= 18 * 60 && totalMinutes < 21 * 60) return 'evening';
  return 'night';
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
pnpm vitest run src/lib/wallMode.test.ts
```
Expected: all 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallMode.ts src/lib/wallMode.test.ts
git commit -m "feat(lib): add getCurrentWallMode pure function with time boundary tests"
```

---

## Task 10: useWallHomeController — Engagement Data + Socket Listener

**Files:**
- Modify: `src/hooks/useWallHomeController.ts`

- [ ] **Step 1: Add state and fetching**

In `useWallHomeController`, add:

1. New state:
```typescript
const [wallMode, setWallMode] = useState<import('../types').WallMode>('ambient');
const [leaderboard, setLeaderboard] = useState<import('../types').LeaderboardEntry[]>([]);
const [powerMission, setPowerMission] = useState<import('../types').PowerMission | null>(null);
const [celebration, setCelebration] = useState<import('../types').MissionCompletedPayload | null>(null);
```

2. Update wallMode every minute:
```typescript
useEffect(() => {
  const update = () => setWallMode(getCurrentWallMode(new Date()));
  update();
  const interval = setInterval(update, 60_000);
  return () => clearInterval(interval);
}, []);
```

3. In `fetchFamilyData`, add leaderboard and power mission fetches:
```typescript
// Add these to the existing Promise.all or parallel fetches
const [leaderboardData, powerMissionData] = await Promise.all([
  fetch(`/api/parents/${parentId}/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : []),
  fetch(`/api/parents/${parentId}/power-mission`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : null),
]);
setLeaderboard(leaderboardData);
setPowerMission(powerMissionData);
```

4. Socket listener for `mission-completed`:
```typescript
// Add this effect (similar to existing stale-data listener pattern in the codebase)
useEffect(() => {
  if (!socket) return;
  const handler = (payload: import('../types').MissionCompletedPayload) => {
    setCelebration(payload);
    setTimeout(() => setCelebration(null), 3000);
  };
  socket.on('mission-completed', handler);
  return () => { socket.off('mission-completed', handler); };
}, [socket]);
```

5. Return new values from the hook:
```typescript
return {
  // ... existing returns
  wallMode,
  leaderboard,
  powerMission,
  celebration,
};
```

> **Note:** Import `getCurrentWallMode` from `../lib/wallMode.js`. Follow the existing socket hook pattern in the file for how `socket` is accessed.

- [ ] **Step 2: Verify no TS errors**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWallHomeController.ts
git commit -m "feat(hooks): add wallMode, leaderboard, powerMission, and celebration state to useWallHomeController"
```

---

## Task 11: XpCelebration Component

**Files:**
- Create: `src/components/parent/XpCelebration.tsx`

- [ ] **Step 1: Implement component**

Create `src/components/parent/XpCelebration.tsx`:

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { MissionCompletedPayload } from '../../types';

interface Props {
  payload: MissionCompletedPayload | null;
  kidName: string;
}

export function XpCelebration({ payload, kidName }: Props) {
  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          key="celebration"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 pointer-events-none"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center"
          >
            <div className="text-8xl mb-4">⭐</div>
            <div className="text-5xl font-black text-white mb-2">{kidName}</div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-7xl font-black text-yellow-400"
            >
              +{payload.xp} XP
            </motion.div>
            {payload.streakDay >= 3 && (
              <div className="mt-4 text-3xl text-orange-400 font-bold">
                🔥 {payload.streakDay} day streak!
              </div>
            )}
            {payload.badgesEarned.length > 0 && (
              <div className="mt-3 text-2xl text-white/80">
                New badge{payload.badgesEarned.length > 1 ? 's' : ''}: {payload.badgesEarned.map(b => b.replace('_', ' ')).join(', ')}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify no TS errors**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/parent/XpCelebration.tsx
git commit -m "feat(ui): add XpCelebration full-screen animation component"
```

---

## Task 12: FamilyLeaderboard Component

**Files:**
- Create: `src/components/parent/FamilyLeaderboard.tsx`

- [ ] **Step 1: Implement component**

Create `src/components/parent/FamilyLeaderboard.tsx`:

```tsx
import { LeaderboardEntry } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  entries: LeaderboardEntry[];
  isWallMode?: boolean;
}

const ROLE_EMOJI: Record<string, string> = { kid: '🧒', parent: '👤', coparent: '👤' };

export function FamilyLeaderboard({ entries, isWallMode }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => (
        <div
          key={entry.userId}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-gray-800',
            idx === 0 && 'ring-2 ring-yellow-400/60',
            isWallMode && 'p-4'
          )}
        >
          <div className={cn('text-2xl w-8 text-center font-black', isWallMode && 'text-3xl')}>
            {idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn('font-semibold truncate', isWallMode ? 'text-lg' : 'text-sm')}>
              {ROLE_EMOJI[entry.role]} {entry.name}
            </div>
          </div>
          <div className="text-right">
            <div className={cn('font-black text-yellow-500', isWallMode ? 'text-2xl' : 'text-base')}>
              {entry.weeklyXp} XP
            </div>
            {entry.deltaFromLastWeek !== 0 && (
              <div className={cn(
                'text-xs font-medium',
                entry.deltaFromLastWeek > 0 ? 'text-emerald-500' : 'text-red-400'
              )}>
                {entry.deltaFromLastWeek > 0 ? '+' : ''}{entry.deltaFromLastWeek}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TS errors**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/parent/FamilyLeaderboard.tsx
git commit -m "feat(ui): add FamilyLeaderboard component with weekly XP and deltas"
```

---

## Task 13: PowerMissionCard Component

**Files:**
- Create: `src/components/parent/PowerMissionCard.tsx`

- [ ] **Step 1: Implement component**

Create `src/components/parent/PowerMissionCard.tsx`:

```tsx
import { Zap } from 'lucide-react';
import { PowerMission } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  mission: PowerMission | null;
  isWallMode?: boolean;
}

export function PowerMissionCard({ mission, isWallMode }: Props) {
  if (!mission) return null;

  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-400/30',
      isWallMode && 'p-5'
    )}>
      <div className="p-3 rounded-xl bg-yellow-400/20 text-yellow-500">
        <Zap size={isWallMode ? 32 : 24} fill="currentColor" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-black text-yellow-500 uppercase tracking-wider', isWallMode && 'text-sm')}>
            ⚡ Power Mission — 2× XP
          </span>
        </div>
        <h3 className={cn('font-bold truncate text-gray-900 dark:text-white', isWallMode ? 'text-xl' : 'text-base')}>
          {mission.title}
        </h3>
        <div className={cn('text-gray-500 dark:text-gray-400', isWallMode ? 'text-base' : 'text-sm')}>
          {mission.assignedKidName} · {mission.xpReward * 2} XP on completion
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TS errors**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/parent/PowerMissionCard.tsx
git commit -m "feat(ui): add PowerMissionCard component"
```

---

## Task 14: GroceryChips Component

**Files:**
- Create: `src/components/parent/GroceryChips.tsx`

The frequent items data is already fetched in `useWallHomeController` as `frequentItems: string[]`. This component renders them and calls an `onAdd` callback.

- [ ] **Step 1: Implement component**

Create `src/components/parent/GroceryChips.tsx`:

```tsx
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  items: string[];
  onAdd: (item: string) => void;
  isWallMode?: boolean;
}

const ITEM_EMOJI: Record<string, string> = {
  milk: '🥛', eggs: '🥚', bread: '🍞', butter: '🧈', cheese: '🧀',
  chicken: '🍗', rice: '🍚', pasta: '🍝', apples: '🍎', bananas: '🍌',
};

export function GroceryChips({ items, onAdd, isWallMode }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {items.map(item => {
        const emoji = ITEM_EMOJI[item.toLowerCase()] ?? '🛒';
        return (
          <button
            key={item}
            onClick={() => onAdd(item)}
            className={cn(
              'flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-full',
              'bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700',
              'text-gray-700 dark:text-gray-200 font-medium',
              'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-400',
              'active:scale-95 transition-all duration-150',
              isWallMode ? 'text-lg px-5 py-3' : 'text-sm'
            )}
          >
            <span>{emoji}</span>
            <span className="capitalize">{item}</span>
            <Plus size={isWallMode ? 18 : 14} className="text-emerald-500" />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TS errors**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/parent/GroceryChips.tsx
git commit -m "feat(ui): add GroceryChips one-tap add component"
```

---

## Task 15: Wire WallHome — Time-Aware Modes + All New Components

**Files:**
- Modify: `src/components/parent/WallHome.tsx`

This is the final wiring task. Read the full `WallHome.tsx` file before making changes to understand the existing layout structure.

- [ ] **Step 1: Read WallHome.tsx**

Read `src/components/parent/WallHome.tsx` in full to understand how `isWallMode`, `useWallHomeController`, and existing sections are laid out.

- [ ] **Step 2: Import new components and types**

At the top of `WallHome.tsx`, add:
```tsx
import { XpCelebration } from './XpCelebration';
import { FamilyLeaderboard } from './FamilyLeaderboard';
import { PowerMissionCard } from './PowerMissionCard';
import { GroceryChips } from './GroceryChips';
import type { WallMode } from '../../types';
```

- [ ] **Step 3: Extract wallMode, leaderboard, powerMission, celebration from controller**

In the component where `useWallHomeController` is called, destructure the new values:
```tsx
const { wallMode, leaderboard, powerMission, celebration, ...existingValues } = useWallHomeController({ ... });
```

- [ ] **Step 4: Add XpCelebration at root level**

At the outermost div of the WallHome component (or wherever the full-screen overlay makes sense), add:
```tsx
<XpCelebration
  payload={celebration}
  kidName={kids.find(k => k.uid === celebration?.userId)?.name ?? ''}
/>
```

- [ ] **Step 5: Add mode-aware section rendering**

In the main wall content area (where `isWallMode` is true), wrap sections conditionally by `wallMode`:

```tsx
{isWallMode && (
  <>
    {/* Morning and After School: show Power Mission */}
    {(wallMode === 'morning' || wallMode === 'afterschool') && powerMission && (
      <PowerMissionCard mission={powerMission} isWallMode />
    )}

    {/* After School and Evening: show Leaderboard */}
    {(wallMode === 'afterschool' || wallMode === 'evening') && leaderboard.length > 0 && (
      <section>
        <h2 className="text-base font-bold text-ui-muted uppercase tracking-wide mb-3">
          This Week
        </h2>
        <FamilyLeaderboard entries={leaderboard} isWallMode />
      </section>
    )}

    {/* All modes except night: show Grocery Chips */}
    {wallMode !== 'night' && frequentItems.length > 0 && (
      <section>
        <h2 className="text-base font-bold text-ui-muted uppercase tracking-wide mb-3">
          Quick Add
        </h2>
        <GroceryChips
          items={frequentItems}
          isWallMode
          onAdd={async (item) => {
            // `lists` and `listsClientService` come from useWallHomeController —
            // verify they are already destructured at the top of WallHome.tsx.
            // If not, add them: const { lists, ... } = useWallHomeController(...)
            const shoppingList = lists.find(l => l.category === 'shopping');
            if (!shoppingList) return;
            await listsClientService.addItem(shoppingList.id, item);
          }}
        />
      </section>
    )}

    {/* Night: minimal — just clock, hide other sections */}
    {wallMode === 'night' && (
      <div className="text-center text-ui-muted text-lg mt-8">
        {/* Clock already rendered above this block */}
      </div>
    )}
  </>
)}
```

- [ ] **Step 6: Verify no TS errors and app builds**

```bash
pnpm lint && pnpm build
```
Expected: clean build

- [ ] **Step 7: Commit**

```bash
git add src/components/parent/WallHome.tsx
git commit -m "feat(wall): wire time-aware wall modes, power mission, leaderboard, grocery chips, and XP celebration"
```

---

## Task 16: Final Integration Test Pass

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass, no regressions

- [ ] **Step 2: Start dev server and manually verify wall mode**

```bash
pnpm dev
```

Navigate to wall view. Verify:
- Wall mode label changes with time (or temporarily hardcode `at(15, 0)` in `getCurrentWallMode` to test afterschool mode)
- Leaderboard renders (may be empty if no XP events yet)
- Power Mission slot renders (or is absent if no pending tasks)
- Grocery chips appear if frequent items exist
- Complete a task — verify XP celebration animation fires on wall

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test(engagement): verify full integration — wall modes, gamification, socket celebrations"
```
