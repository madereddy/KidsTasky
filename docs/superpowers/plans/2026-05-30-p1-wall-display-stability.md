# KidsTasky P1–P3: Wall Display Stability, Skylight Parity & Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 24/7 display stability issues (P1), close Skylight feature gaps (P2), and clean architecture debt (P3) so KidsTasky becomes a better wall-mounted family hub than Skylight Calendar.

**Architecture:** React 19 SPA + Express 5 + SQLite. Real-time via Socket.IO with family-scoped rooms. Two roles: parent and kid. `parentId` is the family grouping key. Wall display runs as a persistent browser tab. P1 fixes socket and worker behavior before P2 adds features.

**Tech Stack:** TypeScript, React 19, Vite, Tailwind v4, Motion, Express 5, better-sqlite3, Socket.IO 4, node-cron, express-rate-limit, bcrypt, googleapis

---

## P1: 24/7 Display Stability & Performance

---

### Task 1: Entity-Scoped Socket Invalidation (Refetch Storm Fix)

**Problem:** Every mutation broadcasts `staleData` → all clients refetch ALL datasets regardless of which entity changed. Google sync (every 5min) triggers fleet-wide full refetch. On a wall display with 5+ clients, this multiplies requests.

**Files:**
- Modify: `src/server/socket.ts` — add `entity` field to staleData payload
- Modify: `src/hooks/useSocket.ts` — filter refetch by entity type
- Modify: `src/App.tsx` — update staleData handler to only refresh relevant data
- Modify: All `src/server/modules/*/routes.ts` that call `emitStaleData` — pass entity name

- [ ] **Step 1: Write failing test — socket emits entity**

```typescript
// src/server/socket.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createSocketWrapper } from './socket.js';

describe('socket staleData entity scoping', () => {
  it('emitStaleData includes entity in payload', () => {
    const emitSpy = vi.fn();
    const mockIo = { to: () => ({ emit: emitSpy }) } as any;
    const wrapper = createSocketWrapper(mockIo);
    wrapper.emitStaleData('parent_123', 'tasks');
    expect(emitSpy).toHaveBeenCalledWith('stale-data', { entity: 'tasks' });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** `npx vitest run src/server/socket.test.ts`

- [ ] **Step 3: Update `src/server/socket.ts` — add entity to emitStaleData signature**

```typescript
// Change emitStaleData signature from:
emitStaleData(parentId: string, entity?: string): void

// Emit payload:
io.to(parentId).emit('stale-data', { entity: entity ?? 'all' });
```

- [ ] **Step 4: Update `src/hooks/useSocket.ts` — filter by entity**

```typescript
// Add entity filter parameter to useSocketStaleData
export function useSocketStaleData(
  parentId: string | null,
  entities: string[],  // only refetch for these entities (or 'all')
  onStale: () => void
) {
  useEffect(() => {
    if (!socket || !parentId) return;
    const handler = (data: { entity?: string }) => {
      if (!data.entity || data.entity === 'all' || entities.includes(data.entity)) {
        onStale();
      }
    };
    socket.on('stale-data', handler);
    return () => { socket.off('stale-data', handler); };
  }, [parentId, entities, onStale]);
}
```

- [ ] **Step 5: Update App.tsx staleData handlers** — pass specific entities to each `useSocketStaleData` call (e.g., tasks hook only fires on `['tasks', 'all']`)

- [ ] **Step 6: Update all emitStaleData call sites** — add entity string to every call in routes.ts files. Search: `grep -r "emitStaleData" src/server/modules`

- [ ] **Step 7: Run tests** `npx vitest run src/server/socket.test.ts src/server/modules/tasks/api.test.ts`

- [ ] **Step 8: Commit**
```bash
git add src/server/socket.ts src/hooks/useSocket.ts src/App.tsx src/server/modules/
git commit -m "perf: entity-scoped socket invalidation to prevent refetch storms"
```

---

### Task 2: Clean Up Uncleaned Intervals

**Problem:** Worker has 3 `setInterval()` calls with no cleanup handles. WallHome clock has `setInterval` with no cleanup. Compound memory leak on 24/7 uptime.

**Files:**
- Modify: `src/server/worker.ts` — store handles, add graceful shutdown
- Modify: `src/components/parent/WallHome.tsx:28` — return cleanup from useEffect

- [ ] **Step 1: Fix WallHome clock leak**

```typescript
// src/components/parent/WallHome.tsx - in the clock useEffect
useEffect(() => {
  const tick = () => setNow(new Date());
  const id = setInterval(tick, 60000);
  return () => clearInterval(id);  // ADD THIS
}, []);
```

- [ ] **Step 2: Fix worker.ts interval cleanup**

```typescript
// src/server/worker.ts — store all handles
const handles: (ReturnType<typeof setInterval> | ReturnType<typeof NodeJS.Timeout>)[] = [];

// Replace bare setInterval with stored handles:
handles.push(setInterval(checkReminders, 60_000));
handles.push(setInterval(checkOverdueTasks, 5 * 60_000));
handles.push(setInterval(cleanupOldPhotos, 15 * 60_000));

// Add shutdown export:
export function stopWorker() {
  handles.forEach(h => clearInterval(h));
  handles.length = 0;
}
```

- [ ] **Step 3: Wire shutdown in server.ts**

```typescript
// server.ts — on process signals
import { stopWorker } from './src/server/worker.js';
process.on('SIGTERM', () => { stopWorker(); process.exit(0); });
process.on('SIGINT', () => { stopWorker(); process.exit(0); });
```

- [ ] **Step 4: Run type check** `npm run lint`

- [ ] **Step 5: Commit**
```bash
git add src/server/worker.ts src/components/parent/WallHome.tsx server.ts
git commit -m "fix: clean up setInterval handles to prevent memory leaks on 24/7 display"
```

---

### Task 3: DB Composite Indexes + Worker N+1 Fix

**Problem:** Worker's overdue task check does a full table scan for all tasks, then issues per-kid query in a loop. Missing composite indexes on hot query paths. Runs every 5 minutes.

**Files:**
- Create: `src/server/migrations/020_composite_indexes.sql`
- Modify: `src/server/worker.ts:107-119` — batch kid query

- [ ] **Step 1: Create migration**

```sql
-- src/server/migrations/020_composite_indexes.sql
-- Composite indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_completions_kid_date ON task_completions (kidId, dateString);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_status ON tasks (parentId, status);
CREATE INDEX IF NOT EXISTS idx_tasks_kid_status ON tasks (assignedKidId, status);
CREATE INDEX IF NOT EXISTS idx_events_start_reminder ON events (startTime, reminderMinutes);
```

- [ ] **Step 2: Fix N+1 in worker.ts overdue check**

```typescript
// BEFORE (N+1):
const tasks = db.prepare('SELECT * FROM tasks WHERE status = ?').all('active');
for (const task of tasks) {
  const kids = db.prepare('SELECT uid, name FROM users WHERE uid IN (?)').all(task.kidIds);
  // ...
}

// AFTER (batch):
const tasks = db.prepare(`
  SELECT t.*, u.name as kidName 
  FROM tasks t
  LEFT JOIN users u ON u.uid = t.assignedKidId
  WHERE t.status = 'active' AND t.parentId IS NOT NULL
`).all();
```

- [ ] **Step 3: Verify migration runs** `npm run dev` — check logs for migration applied

- [ ] **Step 4: Run tests** `npx vitest run src/server/modules/tasks`

- [ ] **Step 5: Commit**
```bash
git add src/server/migrations/020_composite_indexes.sql src/server/worker.ts
git commit -m "perf: add composite DB indexes and fix N+1 worker query"
```

---

### Task 4: Google Sync Circuit Breaker

**Problem:** Google Calendar sync runs every 5 minutes with no backoff on 429 errors. Under rate-limiting, it hammers the API.

**Files:**
- Modify: `src/server/worker.ts` — add backoff state and circuit breaker for Google sync

- [ ] **Step 1: Add backoff state to worker**

```typescript
// At top of worker.ts
const syncBackoff = { failCount: 0, nextAllowedAt: 0 };

function shouldSkipSync(): boolean {
  if (Date.now() < syncBackoff.nextAllowedAt) return true;
  return false;
}

function onSyncSuccess() {
  syncBackoff.failCount = 0;
  syncBackoff.nextAllowedAt = 0;
}

function onSyncFailure(err: any) {
  const is429 = err?.status === 429 || String(err?.message).includes('Quota');
  if (is429) {
    syncBackoff.failCount++;
    // Exponential backoff: 1min, 2min, 4min, 8min, max 30min
    const delayMs = Math.min(Math.pow(2, syncBackoff.failCount) * 60_000, 30 * 60_000);
    syncBackoff.nextAllowedAt = Date.now() + delayMs;
    console.warn(`[worker] Google sync rate-limited. Next attempt in ${delayMs / 60_000}min`);
  }
}
```

- [ ] **Step 2: Apply to sync loop in worker.ts**

```typescript
// In the 5-min sync cron:
if (shouldSkipSync()) return;
try {
  await runGoogleSync();
  onSyncSuccess();
} catch (err) {
  onSyncFailure(err);
}
```

- [ ] **Step 3: Commit**
```bash
git add src/server/worker.ts
git commit -m "fix: add exponential backoff circuit breaker for Google Calendar sync"
```

---

### Task 5: Pause Animations in Sleep/Display Mode

**Problem:** `animate-pulse` on overdue tasks + Motion spring animations run constantly on all mounted TaskCards, burning CPU/GPU on a low-power wall display.

**Files:**
- Modify: `src/components/kid/TaskCard.tsx` — gate pulse animation on `useReducedMotion` or a display-mode context
- Modify: `src/App.tsx` — add `isWallDisplay` context (already has display state)
- Create: `src/contexts/DisplayContext.tsx` — share wall/sleep mode state

- [ ] **Step 1: Create DisplayContext**

```typescript
// src/contexts/DisplayContext.tsx
import { createContext, useContext } from 'react';

interface DisplayContextValue {
  isWallMode: boolean;
  isSleepMode: boolean;
}

export const DisplayContext = createContext<DisplayContextValue>({ isWallMode: false, isSleepMode: false });
export const useDisplayMode = () => useContext(DisplayContext);
```

- [ ] **Step 2: Wrap App with DisplayContext.Provider** — pass wall/sleep state

- [ ] **Step 3: Gate pulse animation in TaskCard.tsx**

```typescript
// src/components/kid/TaskCard.tsx
import { useDisplayMode } from '../../contexts/DisplayContext.js';

const { isWallMode } = useDisplayMode();

// Replace: className="... animate-pulse ..."
// With: className={`... ${!isWallMode ? 'animate-pulse' : ''} ...`}
```

- [ ] **Step 4: Run type check + tests** `npm run lint && npx vitest run`

- [ ] **Step 5: Commit**
```bash
git add src/contexts/DisplayContext.tsx src/components/kid/TaskCard.tsx src/App.tsx
git commit -m "perf: pause CPU-burning animations in wall display and sleep modes"
```

---

## P2: Skylight Feature Parity

---

### Task 6: Touch-Scale Wall UI

**Problem:** Buttons, labels, form inputs use `text-sm`/`px-3 py-2` — unreadable at 10ft on a wall-mounted tablet. No landscape-lock kiosk mode.

**Files:**
- Create: `src/styles/wall.css` — wall-mode CSS class overrides
- Modify: `src/App.tsx` — apply `.wall-mode` class to root when in wall display
- Modify: `src/components/parent/WallHome.tsx` — scale up widget text, hit targets
- Modify: `index.html` — add viewport meta for tablet landscape

Key rules for wall mode:
- Minimum touch target: 56px height (`min-h-14`)
- Body text: `text-base` minimum (currently `text-sm`)
- Buttons: `px-6 py-4` minimum
- Numbers/time: `text-4xl+` for at-a-glance readability

- [ ] **Step 1: Write visual size tests (axe/jest-dom)**

```typescript
// src/components/parent/WallHome.test.tsx
it('clock text is large enough for wall display', () => {
  render(<WallHome ... />);
  const clock = screen.getByTestId('wall-clock');
  expect(clock).toHaveClass('text-5xl'); // minimum for wall
});
```

- [ ] **Step 2: Create wall.css overrides**

```css
/* src/styles/wall.css */
.wall-mode button { min-height: 56px; padding: 1rem 1.5rem; font-size: 1rem; }
.wall-mode .text-sm { font-size: 1rem !important; }
.wall-mode .text-xs { font-size: 0.875rem !important; }
.wall-mode input, .wall-mode select { min-height: 52px; font-size: 1rem; }
```

- [ ] **Step 3: Add `data-wall` attribute to root in App.tsx** when wall mode active

- [ ] **Step 4: Scale WallHome widgets** — clock `text-7xl`, event titles `text-xl`, chore names `text-lg`, all hit targets `min-h-14`

- [ ] **Step 5: Add landscape orientation hint to index.html**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, orientation=landscape">
```

- [ ] **Step 6: Run tests + visual review on tablet viewport** `npm run dev` → resize to 1024×768

- [ ] **Step 7: Commit**
```bash
git add src/styles/wall.css src/App.tsx src/components/parent/WallHome.tsx index.html
git commit -m "feat: touch-scale wall UI with minimum 56px targets and readable text sizes"
```

---

### Task 7: Family-Visible Weekly Chore Grid

**Problem:** `ChoreChart.tsx` is a desktop table visible only to parents. No kid-facing or wall-facing weekly chore grid showing "who does what this week" with progress indicators.

**Files:**
- Create: `src/components/shared/WeeklyChoreGrid.tsx` — shared chore grid component
- Modify: `src/components/parent/WallHome.tsx` — embed WeeklyChoreGrid widget
- Modify: `src/components/kid/KidDashboard.tsx` — embed WeeklyChoreGrid

- [ ] **Step 1: Write component test**

```typescript
// src/components/shared/WeeklyChoreGrid.test.tsx
it('renders chore rows for each kid', () => {
  render(<WeeklyChoreGrid tasks={mockTasks} kids={mockKids} completions={mockCompletions} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Make Bed')).toBeInTheDocument();
});

it('shows filled circle for completed chore', () => {
  render(<WeeklyChoreGrid tasks={mockTasks} kids={mockKids} completions={completedAll} />);
  expect(screen.getAllByTestId('chore-complete')).toHaveLength(7);
});
```

- [ ] **Step 2: Run test — expect FAIL** `npx vitest run src/components/shared/WeeklyChoreGrid.test.tsx`

- [ ] **Step 3: Create WeeklyChoreGrid component**

Props interface:
```typescript
interface WeeklyChoreGridProps {
  tasks: Task[];        // recurring tasks for the family
  kids: User[];         // kid members with colors
  completions: TaskCompletion[];
  weekStart?: Date;     // defaults to current week Monday
  compact?: boolean;    // for WallHome widget vs full view
}
```

Grid layout: rows = kids, columns = Mon-Sun. Cell = chore dot (filled if done, hollow if pending, gray if N/A). Kid name left column, color-coded.

- [ ] **Step 4: Add to WallHome as a collapsible widget section**

- [ ] **Step 5: Add to KidDashboard as a "This Week" view**

- [ ] **Step 6: Run tests** `npx vitest run src/components/shared/WeeklyChoreGrid.test.tsx`

- [ ] **Step 7: Commit**
```bash
git add src/components/shared/WeeklyChoreGrid.tsx src/components/parent/WallHome.tsx src/components/kid/KidDashboard.tsx
git commit -m "feat: family-visible weekly chore grid for wall display and kid dashboard"
```

---

### Task 8: Kid Rewards Shop UI

**Problem:** Rewards exist in backend (RewardManager creates them) but kid view only shows a raw claim button. No visual shop with reward cards, allowance ledger, or redemption history.

**Files:**
- Create: `src/components/kid/RewardsShop.tsx` — visual rewards shop
- Create: `src/services/rewards.ts` (or extend existing) — add `getRedeemHistory` endpoint
- Modify: `src/server/modules/rewards/routes.ts` — add `GET /parents/:parentId/rewards/history` endpoint
- Modify: `src/components/kid/KidDashboard.tsx` — add Rewards tab

- [ ] **Step 1: Add rewards history API endpoint**

```typescript
// src/server/modules/rewards/routes.ts
rewardsRouter.get('/parents/:parentId/rewards/history', authenticateUser, assertParentScope, (req, res) => {
  const history = rewardsService.getRedemptionHistory(req.params.parentId as string);
  res.json(history);
});
```

- [ ] **Step 2: Write RewardsShop component test**

```typescript
it('renders reward cards with cost', () => {
  render(<RewardsShop rewards={mockRewards} kidXP={200} onClaim={vi.fn()} />);
  expect(screen.getByText('Extra Screen Time')).toBeInTheDocument();
  expect(screen.getByText('100 ⭐')).toBeInTheDocument();
});

it('disables claim button when XP insufficient', () => {
  render(<RewardsShop rewards={[{...reward, cost: 500}]} kidXP={50} onClaim={vi.fn()} />);
  expect(screen.getByRole('button', { name: /claim/i })).toBeDisabled();
});
```

- [ ] **Step 3: Create RewardsShop.tsx**

Layout:
- Grid of reward cards with icon, name, cost in stars
- Each card: large star cost display, claim button (disabled if insufficient XP)
- Ledger section below: Earned / Spent / Balance columns
- Recent redemptions list

- [ ] **Step 4: Add to KidDashboard as "Shop" tab**

- [ ] **Step 5: Run tests** `npx vitest run src/components/kid/RewardsShop.test.tsx`

- [ ] **Step 6: Commit**
```bash
git add src/components/kid/RewardsShop.tsx src/server/modules/rewards/routes.ts src/components/kid/KidDashboard.tsx
git commit -m "feat: kid-facing rewards shop with visual cards and allowance ledger"
```

---

### Task 9: Auto-Rotate Display Mode

**Problem:** Wall display is a static WallHome view. No auto-rotation between calendar, chores, weather, and photos — the always-on "runs itself" behavior that makes Skylight compelling.

**Files:**
- Create: `src/components/shared/DisplayCarousel.tsx` — rotating widget manager
- Modify: `src/components/parent/WallHome.tsx` — wire DisplayCarousel
- Modify: `src/server/modules/settings/` — add `displayRotation` settings (enabled, interval, order)

- [ ] **Step 1: Add displayRotation to settings**

Migration:
```sql
-- src/server/migrations/021_display_rotation.sql
ALTER TABLE family_settings ADD COLUMN displayRotationEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE family_settings ADD COLUMN displayRotationInterval INTEGER NOT NULL DEFAULT 30;
ALTER TABLE family_settings ADD COLUMN displayRotationOrder TEXT NOT NULL DEFAULT '["chores","calendar","weather","photos"]';
```

Update `FamilySettings` type and `settingsService.saveSettings`.

- [ ] **Step 2: Write DisplayCarousel test**

```typescript
it('advances slide after interval', async () => {
  vi.useFakeTimers();
  render(<DisplayCarousel slides={['chores', 'calendar']} intervalSec={30} />);
  expect(screen.getByTestId('slide-chores')).toBeVisible();
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByTestId('slide-calendar')).toBeVisible();
  vi.useRealTimers();
});
```

- [ ] **Step 3: Create DisplayCarousel.tsx**

```typescript
interface DisplayCarouselProps {
  slides: ('chores' | 'calendar' | 'weather' | 'photos')[];
  intervalSec: number;
  children: Record<string, React.ReactNode>;
}
```

Uses `setInterval` with cleanup. Smooth fade transition between slides. Touch-swipe to advance manually.

- [ ] **Step 4: Add rotation settings toggle to SettingsView** — enable/disable, interval (15/30/60s), slide order drag-to-reorder

- [ ] **Step 5: Wire into WallHome** when `displayRotationEnabled`

- [ ] **Step 6: Run tests** `npx vitest run src/components/shared/DisplayCarousel.test.tsx`

- [ ] **Step 7: Commit**
```bash
git add src/components/shared/DisplayCarousel.tsx src/components/parent/WallHome.tsx src/server/migrations/021_display_rotation.sql
git commit -m "feat: auto-rotate display mode for always-on wall hub (chores/calendar/weather/photos)"
```

---

### Task 10: Scheduled Auto Lock / Sleep

**Problem:** `SleepModeOverlay` exists but isn't triggered by configured `sleepStart`/`sleepEnd` times automatically — it requires manual activation.

**Files:**
- Modify: `src/hooks/useSleepMode.ts` (create if absent) — time-based sleep trigger
- Modify: `src/components/shared/SleepModeOverlay.tsx` — connect to hook
- Modify: `src/App.tsx` — wire sleep hook

- [ ] **Step 1: Write sleep schedule test**

```typescript
it('enters sleep mode when current time matches sleepStart', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-30T21:05:00'));
  const { result } = renderHook(() => useSleepMode({ sleepStart: '21:00', sleepEnd: '07:00' }));
  expect(result.current.isSleeping).toBe(true);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Create `src/hooks/useSleepMode.ts`**

```typescript
export function useSleepMode(settings: { sleepStart?: string; sleepEnd?: string }) {
  const [isSleeping, setIsSleeping] = useState(false);

  useEffect(() => {
    function checkSleepTime() {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const { sleepStart = '22:00', sleepEnd = '07:00' } = settings;
      const sleeping = isInSleepWindow(hhmm, sleepStart, sleepEnd);
      setIsSleeping(sleeping);
    }
    checkSleepTime();
    const id = setInterval(checkSleepTime, 60_000);
    return () => clearInterval(id);
  }, [settings.sleepStart, settings.sleepEnd]);

  return { isSleeping };
}

function isInSleepWindow(now: string, start: string, end: string): boolean {
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end; // overnight window
}
```

- [ ] **Step 3: Wire hook in App.tsx** — replace manual sleep toggle with `useSleepMode` return value, keep manual override

- [ ] **Step 4: Run tests** `npx vitest run src/hooks/useSleepMode.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/hooks/useSleepMode.ts src/components/shared/SleepModeOverlay.tsx src/App.tsx
git commit -m "feat: automatic time-based sleep mode trigger using configured sleepStart/sleepEnd"
```

---

### Task 11: Photo Frame Enhancements

**Problem:** PhotoScreensaver shows a flat static carousel. No Ken Burns zoom effect, no duration customization, no shuffle toggle, no caption display.

**Files:**
- Modify: `src/components/shared/PhotoScreensaver.tsx` — Ken Burns, captions, shuffle, duration

- [ ] **Step 1: Write screensaver tests**

```typescript
it('shows caption when photo has caption', () => {
  const photos = [{ id: '1', url: '/test.jpg', caption: 'Summer 2025' }];
  render(<PhotoScreensaver photos={photos} />);
  expect(screen.getByText('Summer 2025')).toBeInTheDocument();
});
```

- [ ] **Step 2: Add Ken Burns CSS animation**

```css
/* Add to global CSS */
@keyframes ken-burns {
  0%   { transform: scale(1.0) translate(0, 0); }
  100% { transform: scale(1.1) translate(-2%, -2%); }
}
.ken-burns { animation: ken-burns 10s ease-in-out infinite alternate; }
```

- [ ] **Step 3: Update PhotoScreensaver.tsx**

Add props:
- `shuffleEnabled?: boolean` — randomize order
- `displayDurationSec?: number` — default 10
- `showCaptions?: boolean` — default true

Implement:
- Ken Burns via CSS class on `<img>` 
- Caption fade-in overlay at bottom
- Shuffle: `useMemo` on photos array with randomized order when enabled
- Cross-fade transition between photos (Motion `AnimatePresence`)

- [ ] **Step 4: Add screensaver settings to SettingsView** — duration slider, shuffle toggle, caption toggle

- [ ] **Step 5: Run tests** `npx vitest run src/components/shared/PhotoScreensaver.test.tsx`

- [ ] **Step 6: Commit**
```bash
git add src/components/shared/PhotoScreensaver.tsx src/components/parent/SettingsView.tsx
git commit -m "feat: photo screensaver Ken Burns zoom, captions, shuffle, and duration control"
```

---

### Task 12: Per-Member Calendar Colors Enforced

**Problem:** Calendar events show color based on event color or assignedToId, but there's no UI to set per-member colors that enforce consistently across all calendar views.

**Files:**
- Verify: `src/server/modules/users/service.ts` — `setMemberColor` exists ✓
- Modify: `src/components/calendar/CalendarView.tsx` — look up member color by attendee uid
- Modify: `src/components/parent/SettingsView.tsx` — member color picker section

- [ ] **Step 1: Update CalendarView to use member colors**

```typescript
// In CalendarView — when rendering event chip:
const eventColor = event.assignedToId
  ? (memberColorMap[event.assignedToId] ?? event.color)
  : event.color;
```

where `memberColorMap` is built from `kids.reduce((m, k) => ({ ...m, [k.uid]: k.color }), {})`.

- [ ] **Step 2: Add member color picker to SettingsView** (already has per-kid color via `/users/:uid/color` — expose in a clear "Member Colors" section with color swatches)

- [ ] **Step 3: Run tests + visual check**

- [ ] **Step 4: Commit**
```bash
git add src/components/calendar/CalendarView.tsx src/components/parent/SettingsView.tsx
git commit -m "feat: per-member calendar colors enforced across all views"
```

---

## P3: Architecture Debt

---

### Task 13: Move Raw DB Calls from Routes to Services

**Problem:** 8 route files call `db.prepare()` directly, bypassing the service layer. This scatters query logic, prevents optimization, and creates security audit gaps.

**Affected files:**
- `src/server/modules/users/routes.ts` — invite lookup at :56
- `src/server/modules/notifications/routes.ts` — push_subscriptions direct db
- `src/server/modules/invites/routes.ts` — coparent invite query at :50
- Other modules as found by: `grep -r "db.prepare" src/server/modules/*/routes.ts`

- [ ] **Step 1: Audit — list all raw db.prepare in routes**
```bash
grep -rn "db.prepare" src/server/modules/*/routes.ts
```

- [ ] **Step 2: For each hit, move to corresponding service.ts** — create new service method, update route to call it

- [ ] **Step 3: Run full test suite** `npx vitest run`

- [ ] **Step 4: Commit**
```bash
git commit -m "refactor: move raw db calls from routes into service layer"
```

---

### Task 14: Add Transactions to Multi-Step Mutations

**Problem:** `tasks/service.ts:completeTask()` does multiple db writes (update task, add XP, create notification) without atomicity. Race condition possible under concurrent kid sessions.

**Files:**
- Modify: `src/server/modules/tasks/service.ts` — wrap completeTask in `db.transaction()`
- Modify: `src/server/modules/rewards/service.ts` — verify claimReward already has transaction ✓

- [ ] **Step 1: Write concurrent completion test**

```typescript
it('concurrent task completions do not corrupt XP', async () => {
  // Two kids complete the same shared task simultaneously
  await Promise.all([completeTask(kid1, taskId), completeTask(kid2, taskId)]);
  const task = getTask(taskId);
  expect(['completed', 'active']).toContain(task.status); // one or the other, not corrupted
});
```

- [ ] **Step 2: Wrap completeTask in transaction**

```typescript
// src/server/modules/tasks/service.ts
completeTask: db.transaction((kidId: string, taskId: string) => {
  // 1. Update task status
  // 2. Insert completion record
  // 3. Award XP to kid
  // 4. Check prerequisites
})
```

- [ ] **Step 3: Run tests** `npx vitest run src/server/modules/tasks`

- [ ] **Step 4: Commit**
```bash
git add src/server/modules/tasks/service.ts
git commit -m "fix: wrap completeTask in db.transaction to prevent race conditions under concurrent sessions"
```

---

### Task 15: Backend Service Unit Tests

**Problem:** All 20 `src/server/modules/*/service.ts` files lack unit tests. Business logic (XP calculation, prerequisite checks, task scheduling) has zero regression coverage.

**Priority services to test first:**
- `tasks/service.ts` — prerequisite logic, XP award, recurring task reset
- `rewards/service.ts` — XP deduction, redemption ledger
- `routines/service.ts` — schedule generation

- [ ] **Step 1: tasks/service unit tests**
  - prerequisite: task can't complete if blocker not done
  - XP: awarded correctly on completion
  - recurring: task resets next day after completion

- [ ] **Step 2: rewards/service unit tests**
  - claim: XP deducted, ledger entry created
  - reject claim if insufficient XP

- [ ] **Step 3: Run** `npx vitest run src/server/modules/tasks/service.test.ts src/server/modules/rewards/service.test.ts`

- [ ] **Step 4: Commit**
```bash
git commit -m "test: backend service unit tests for tasks/rewards business logic"
```

---

### Task 16: App.tsx Refactor

**Problem:** App.tsx is 605 lines with 20 useState/useCallback/useEffect calls. No Context/reducer. Props drilled through ParentDashboard (350+ lines). RefreshCategories and refreshKids recreated every render.

**Files:**
- Create: `src/contexts/FamilyDataContext.tsx` — family data + refresh functions
- Modify: `src/App.tsx` — move state/fetchers into context
- Modify: `src/components/parent/ParentDashboard.tsx` — use context instead of props

- [ ] **Step 1: Create FamilyDataContext**

```typescript
// src/contexts/FamilyDataContext.tsx
interface FamilyDataContextValue {
  kids: User[];
  categories: Category[];
  refreshKids: () => Promise<void>;
  refreshCategories: () => Promise<void>;
}
export const FamilyDataContext = createContext<FamilyDataContextValue>(...);
```

- [ ] **Step 2: Move state from App.tsx to context**

- [ ] **Step 3: Update ParentDashboard to use `useFamilyData()` hook** instead of receiving props

- [ ] **Step 4: Run full test suite** `npx vitest run`

- [ ] **Step 5: Commit**
```bash
git commit -m "refactor: extract FamilyDataContext to eliminate prop drilling in App.tsx"
```

---

## Execution Order

```
P1 (stability first — unblock 24/7 use):
  Task 1 (socket scoping) → Task 2 (interval cleanup) → Task 3 (indexes+N+1) → Task 4 (circuit breaker) → Task 5 (animations)

P2 (Skylight parity — highest user value first):
  Task 6 (wall UI scale) → Task 7 (chore grid) → Task 8 (rewards shop) → Task 9 (auto-rotate) → Task 10 (auto-sleep) → Task 11 (photo frame) → Task 12 (member colors)

P3 (debt — safe to parallelize or defer):
  Task 13 → Task 14 → Task 15 → Task 16
```

**Start each P2 task only after P1 is fully merged.**  
**P3 tasks can be done in any order and don't block P2.**
