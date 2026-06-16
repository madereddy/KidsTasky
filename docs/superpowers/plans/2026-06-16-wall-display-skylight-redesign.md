# Wall Display Skylight-Inspired Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the wall display (`WallHome.tsx` wall mode) to match Skylight Calendar's clarity — expandable kid chore cards, larger agenda text, clutter-free resting state with context shown briefly on screensaver wake.

**Architecture:** Four files change. `PhotoScreensaver.tsx` gains a dismiss callback. `App.tsx` threads a `wallJustWoke` boolean pulse to `WallHome`. `WallHome.tsx` replaces left-panel progress bars with expandable kid cards, cleans the right panel, and renders a new `WallWakeOverlay` for 5s post-screensaver. All wall-mode JSX switches to semantic design-system tokens.

**Tech Stack:** React 19, Tailwind CSS v4 (class-based dark mode via `.theme-dark`), `motion/react` for animation, Vitest + @testing-library/react for tests.

---

## File Map

| File | Role |
|------|------|
| `src/components/shared/PhotoScreensaver.tsx` | Fix: always fire `onDismiss?.()` on user tap |
| `src/App.tsx` | Wire: `wallJustWoke` state → `WallHome` prop |
| `src/components/parent/WallWakeOverlay.tsx` | New: frosted overlay shown for 5s after screensaver wake |
| `src/components/parent/WallHome.tsx` | Main: expandable kid cards, bigger agenda, token fixes, overlay integration |

**Existing test files to extend:**
- `src/components/parent/WallHome.test.tsx`
- `src/components/shared/PhotoScreensaver.test.tsx` (tests live in a `describe.skip` — add to the skipped block, do NOT unskip)

**New test file:**
- `src/components/parent/WallWakeOverlay.test.tsx`

---

## Task 1: Fix PhotoScreensaver onDismiss signal

`PhotoScreensaver.tsx` line 100–106 currently calls `onDismiss?.()` only when `forceIdle` is true. Normal user-tap dismiss (non-preview) calls `setIsIdle(false)` but never notifies `App.tsx`. Fix: always call `onDismiss?.()` after `setIsIdle(false)`.

**Files:**
- Modify: `src/components/shared/PhotoScreensaver.tsx:100-106`
- Modify: `src/components/shared/PhotoScreensaver.test.tsx` (add test inside existing `describe.skip` block)

- [ ] **Step 1: Add failing test inside the existing `describe.skip` block**

Open `src/components/shared/PhotoScreensaver.test.tsx`. Add this test inside `describe.skip('PhotoScreensaver', () => {` after the existing tests:

```tsx
it('calls onDismiss when user taps screensaver in normal (non-preview) mode', async () => {
  const onDismiss = vi.fn();
  render(
    <PhotoScreensaver
      photos={[{ id: '1', url: STUB_URL }]}
      forceIdle={false}
      onDismiss={onDismiss}
      idleMinutes={5}
    />
  );
  // Advance time AFTER render so the idle timer inside the component fires
  vi.advanceTimersByTime(5 * 60 * 1000);
  const img = await screen.findByRole('img');
  fireEvent.click(img);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
```

Note: this test stays skipped (inside `describe.skip`) due to the documented heap leak. Its presence documents the expected behavior and can be validated manually.

- [ ] **Step 2: Apply the fix**

In `src/components/shared/PhotoScreensaver.tsx`, replace `handleDismiss` (lines 100–106):

```tsx
// Before:
const handleDismiss = () => {
  if (forceIdle && onDismiss) {
    onDismiss();
    return;
  }
  setIsIdle(false);
};

// After:
const handleDismiss = () => {
  if (forceIdle && onDismiss) {
    onDismiss();
    return;
  }
  setIsIdle(false);
  onDismiss?.();
};
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

```bash
pnpm vitest run src/components/shared/PhotoScreensaver.test.tsx
```

Expected: the describe block is skipped — output shows `0 tests`, no failures.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/PhotoScreensaver.tsx src/components/shared/PhotoScreensaver.test.tsx
git commit -m "fix: call onDismiss on user-initiated screensaver dismiss (not just preview mode)"
```

---

## Task 2: Wire wallJustWoke in App.tsx

Add `wallJustWoke` state in `App.tsx`. Update `PhotoScreensaver`'s `onDismiss` handler to set it. Pass it to `WallHome`.

**Files:**
- Modify: `src/App.tsx` (near line 146 for state, line 336 for WallHome JSX, line 399 for PhotoScreensaver JSX)

- [ ] **Step 1: Add `wallJustWoke` state**

In `App.tsx`, find the block of `useState` calls near line 146 (near `screensaverPreview`). Add:

```tsx
const [wallJustWoke, setWallJustWoke] = useState(false);
```

- [ ] **Step 2: Update PhotoScreensaver `onDismiss` (line 399)**

Find the `<PhotoScreensaver ... onDismiss={screensaverPreview ? () => setScreensaverPreview(false) : undefined} ...>` line. Replace the `onDismiss` prop:

```tsx
// Before:
onDismiss={screensaverPreview ? () => setScreensaverPreview(false) : undefined}

// After:
onDismiss={() => {
  if (screensaverPreview) {
    setScreensaverPreview(false);
  } else {
    setWallJustWoke(true);
  }
}}
```

- [ ] **Step 3: Pass `justWoke` prop to WallHome (line 336)**

Find the `<WallHome ... />` JSX. Add `justWoke={wallJustWoke}`:

```tsx
<WallHome
  parentId={familyParentId}
  profile={profile}
  kids={kids}
  memberColorMap={memberColorMap}
  isLocked={isLocked}
  onManage={() => goToSection('manage')}
  settings={familySettings}
  justWoke={wallJustWoke}
/>
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/components/parent/WallHome.test.tsx
```

Expected: existing 3 tests pass. `WallHome` will have a TypeScript error on the new prop until Task 4 adds it — that's fine, the test file doesn't test `justWoke` yet.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: thread wallJustWoke signal from PhotoScreensaver to WallHome"
```

---

## Task 3: Create WallWakeOverlay component

New component: frosted overlay displayed over the right panel after screensaver wake. Shows `IntelligenceHeader`, `PowerMissionCard`, `GroceryChips`. Animated in/out via `motion/react`. Dismisses on click.

**Files:**
- Create: `src/components/parent/WallWakeOverlay.tsx`
- Create: `src/components/parent/WallWakeOverlay.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/parent/WallWakeOverlay.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WallWakeOverlay } from './WallWakeOverlay';
import type { PowerMission } from '../../types';

vi.mock('../shared/IntelligenceHeader', () => ({
  IntelligenceHeader: () => <div data-testid="intelligence-header">IntelligenceHeader</div>,
}));
vi.mock('./PowerMissionCard', () => ({
  PowerMissionCard: ({ mission }: any) => mission ? <div data-testid="power-mission">PowerMission</div> : null,
}));
vi.mock('./GroceryChips', () => ({
  GroceryChips: ({ items }: any) => items.length > 0 ? <div data-testid="grocery-chips">GroceryChips</div> : null,
}));

const baseProps = {
  onDismiss: vi.fn(),
  intelligence: { nextUp: null, meal: null },
  powerMission: null,
  frequentItems: [],
  wallMode: 'ambient' as const,
  onAddIngredients: vi.fn(),
  onQuickAdd: vi.fn(),
};

describe('WallWakeOverlay', () => {
  it('renders IntelligenceHeader', () => {
    render(<WallWakeOverlay {...baseProps} />);
    expect(screen.getByTestId('intelligence-header')).toBeInTheDocument();
  });

  it('calls onDismiss when clicked', () => {
    const onDismiss = vi.fn();
    render(<WallWakeOverlay {...baseProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('intelligence-header'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders PowerMissionCard in morning wallMode', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="morning"
        powerMission={{ taskId: '1', title: 'Clean room', xpReward: 50, assignedKidId: 'k1', assignedKidName: 'Emma' } as PowerMission}
      />
    );
    expect(screen.getByTestId('power-mission')).toBeInTheDocument();
  });

  it('hides PowerMissionCard in ambient wallMode', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="ambient"
        powerMission={{ taskId: '1', title: 'Clean room', xpReward: 50, assignedKidId: 'k1', assignedKidName: 'Emma' } as PowerMission}
      />
    );
    expect(screen.queryByTestId('power-mission')).not.toBeInTheDocument();
  });

  it('renders GroceryChips when items present and not night', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="morning"
        frequentItems={['milk', 'eggs']}
      />
    );
    expect(screen.getByTestId('grocery-chips')).toBeInTheDocument();
  });

  it('hides GroceryChips in night wallMode', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="night"
        frequentItems={['milk', 'eggs']}
      />
    );
    expect(screen.queryByTestId('grocery-chips')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm vitest run src/components/parent/WallWakeOverlay.test.tsx
```

Expected: FAIL — `WallWakeOverlay` not found.

- [ ] **Step 3: Create the component**

Create `src/components/parent/WallWakeOverlay.tsx`:

```tsx
import React from 'react';
import { motion } from 'motion/react';
import { DailyIntelligence, PowerMission, WallMode } from '../../types';
import { IntelligenceHeader } from '../shared/IntelligenceHeader';
import { PowerMissionCard } from './PowerMissionCard';
import { GroceryChips } from './GroceryChips';

interface Props {
  onDismiss: () => void;
  intelligence: DailyIntelligence;
  powerMission: PowerMission | null;
  frequentItems: string[];
  wallMode: WallMode;
  onAddIngredients: () => void;
  onQuickAdd: (text: string) => void;
}

export function WallWakeOverlay({
  onDismiss,
  intelligence,
  powerMission,
  frequentItems,
  wallMode,
  onAddIngredients,
  onQuickAdd,
}: Props) {
  const showPowerMission = wallMode === 'morning' || wallMode === 'afterschool';
  const showGrocery = wallMode !== 'night';

  return (
    <motion.div
      className="absolute inset-x-0 top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-ui-soft p-6 cursor-pointer"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
      onClick={onDismiss}
    >
      <IntelligenceHeader data={intelligence} onAddIngredients={onAddIngredients} />
      {showPowerMission && (
        <div className="mt-3">
          <PowerMissionCard mission={powerMission} isWallMode />
        </div>
      )}
      {showGrocery && (
        <div className="mt-3">
          <GroceryChips items={frequentItems} onAdd={onQuickAdd} isWallMode />
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/components/parent/WallWakeOverlay.test.tsx
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/parent/WallWakeOverlay.tsx src/components/parent/WallWakeOverlay.test.tsx
git commit -m "feat: add WallWakeOverlay component shown after screensaver dismiss"
```

---

## Task 4: WallHome left panel — expandable kid cards

Replace progress bars with Skylight-style expandable avatar cards. Add `justWoke` prop. Token-fix `SkyLiveClock`. Widen left panel.

**Files:**
- Modify: `src/components/parent/WallHome.tsx`
- Modify: `src/components/parent/WallHome.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `WallHome.test.tsx` inside the existing `describe('WallHome', ...)` block. First, update `baseProps` to include `justWoke`:

```tsx
// Update baseProps (add justWoke: false)
const baseProps = {
  parentId: 'p1',
  profile: { uid: 'p1', name: 'Parent', role: 'parent' as const, parentId: 'p1', email: 'p@test.com' },
  kids: [],
  memberColorMap: {},
  isLocked: false,
  onManage: vi.fn(),
  justWoke: false,
};
```

Then add these tests:

```tsx
it('shows kid avatar card with name and task count in wall mode', async () => {
  const tasksClientService = await import('../../services/tasks');
  (tasksClientService.tasksClientService.getTasksForKid as any).mockResolvedValue([
    { id: 't1', title: 'Make bed', status: 'active' },
    { id: 't2', title: 'Dishes', status: 'active' },
  ]);
  (tasksClientService.tasksClientService.getCompletionsForKid as any).mockResolvedValue([]);

  render(
    <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
      <WallHome
        {...baseProps}
        isLocked={true}
        kids={[{ uid: 'k1', name: 'Emma', role: 'kid' as const, parentId: 'p1', email: 'e@test.com' }]}
        memberColorMap={{ k1: '#6366f1' }}
      />
    </DisplayContext.Provider>
  );
  expect(await screen.findByText('Emma')).toBeInTheDocument();
});

it('expands kid card on click in wall mode', async () => {
  const tasksClientService = await import('../../services/tasks');
  (tasksClientService.tasksClientService.getTasksForKid as any).mockResolvedValue([
    { id: 't1', title: 'Make bed', status: 'active' },
  ]);
  (tasksClientService.tasksClientService.getCompletionsForKid as any).mockResolvedValue([]);

  render(
    <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
      <WallHome
        {...baseProps}
        isLocked={true}
        kids={[{ uid: 'k1', name: 'Emma', role: 'kid' as const, parentId: 'p1', email: 'e@test.com' }]}
        memberColorMap={{ k1: '#6366f1' }}
      />
    </DisplayContext.Provider>
  );
  const emmaCard = await screen.findByText('Emma');
  fireEvent.click(emmaCard.closest('[data-testid="kid-card-k1"]')!);
  expect(await screen.findByText('Make bed')).toBeInTheDocument();
});
```

Replace line 2 of `WallHome.test.tsx` (the existing `@testing-library/react` import) with:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
```
Do not add a second import — replace the existing one.

- [ ] **Step 2: Run to confirm tests fail**

```bash
pnpm vitest run src/components/parent/WallHome.test.tsx
```

Expected: FAIL — new tests fail (kid-card testid not present, task names not shown).

- [ ] **Step 3: Add `justWoke` prop to WallHome interface**

In `src/components/parent/WallHome.tsx`, update `interface Props`:

```tsx
interface Props {
  parentId: string;
  profile: UserProfile;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
  isLocked: boolean;
  onManage: () => void;
  settings?: any;
  justWoke?: boolean;  // ← add this
}
```

Update the function signature to destructure it:
```tsx
export function WallHome({ parentId, profile, kids, memberColorMap, isLocked, onManage, settings, justWoke = false }: Props) {
```

- [ ] **Step 4: Add `expandedKidId` state**

Inside `WallHome`, after the existing state declarations, add:

```tsx
const [expandedKidId, setExpandedKidId] = useState<string | null>(null);
```

- [ ] **Step 5: Token-fix SkyLiveClock**

Replace the `SkyLiveClock` function (lines 56–76) to use semantic tokens:

```tsx
function SkyLiveClock({ use24h = false }: { use24h?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div data-testid="wall-clock">
      <div className="text-7xl font-black tabular-nums leading-none text-ui-primary">
        {format(now, use24h ? 'H:mm' : 'h:mm')}
        {!use24h && <span className="text-3xl font-semibold ml-2 text-ui-muted-2">{format(now, 'a')}</span>}
      </div>
      <div className="mt-2 text-xs font-bold text-ui-muted-2 uppercase tracking-[0.15em]">
        {format(now, 'EEEE')}
      </div>
      <div className="text-base font-semibold text-ui-secondary mt-0.5">
        {format(now, 'MMMM d, yyyy')}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Widen left panel and replace progress bars with kid cards**

Inside the wall mode JSX (the `if (isWallMode)` block), find the `<aside>` tag and update its className from `w-64 xl:w-72` to `w-72 xl:w-80`.

Find the existing "Chores" section (the `{kids.length > 0 && (...)}` block inside `<aside>`). Replace the entire block:

```tsx
{kids.length > 0 && (
  <>
    <div className="mx-8 h-px bg-ui-soft" />
    <div className="px-6 py-5 flex-1 min-h-0 overflow-y-auto">
      <p className="text-xs font-bold text-ui-muted-2 uppercase tracking-[0.15em] mb-4">
        Chores
      </p>
      <div className="space-y-3">
        {kids.map((kid) => {
          const tasks = (tasksByKid[kid.uid] || []).filter(t => t.status !== 'archived');
          const comps = completionsByKid[kid.uid] || [];
          const completedIds = new Set(comps.map(c => c.taskId));
          const done = tasks.filter(t => completedIds.has(t.id)).length;
          const total = tasks.length;
          const allDone = total > 0 && done >= total;
          const remaining = total - done;
          const color = memberColorMap[kid.uid] || '#6366f1';
          const isExpanded = expandedKidId === kid.uid;

          return (
            <div
              key={kid.uid}
              data-testid={`kid-card-${kid.uid}`}
              className={cn(
                'rounded-2xl border-2 cursor-pointer min-h-[64px]',
                allDone ? 'border-emerald-500' : 'border-ui'
              )}
              onClick={() => setExpandedKidId(isExpanded ? null : kid.uid)}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 px-3 py-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {kid.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ui-primary">{kid.name}</div>
                  <div className={cn('text-xs', allDone ? 'text-emerald-600 font-semibold' : 'text-ui-muted')}>
                    {allDone ? 'All done!' : `${done} of ${total} done`}
                  </div>
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {allDone ? '✓' : remaining}
                </div>
              </div>

              {/* Expanded task rows */}
              {isExpanded && tasks.length > 0 && (
                <div className="pl-[52px] pr-3 pb-3 flex flex-col gap-1.5">
                  {tasks.map(task => {
                    const isDone = completedIds.has(task.id);
                    return (
                      <div key={task.id} className="flex items-center gap-2">
                        <div className={cn(
                          'w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center',
                          isDone
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-indigo-400'
                        )}>
                          {isDone && <span className="text-[10px] text-emerald-600">✓</span>}
                        </div>
                        <span className={cn(
                          'text-xs',
                          isDone ? 'line-through text-ui-muted-2' : 'text-ui-primary font-medium'
                        )}>
                          {task.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </>
)}
```

- [ ] **Step 7: Run tests**

```bash
pnpm vitest run src/components/parent/WallHome.test.tsx
```

Expected: all 5 tests pass (3 existing + 2 new).

- [ ] **Step 8: Commit**

```bash
git add src/components/parent/WallHome.tsx src/components/parent/WallHome.test.tsx
git commit -m "feat: replace wall mode progress bars with expandable kid chore cards"
```

---

## Task 5: WallHome right panel — cleanup and size bumps

Remove IntelligenceHeader, GroceryChips, PowerMissionCard from the resting right panel. Add `relative` to `<main>`. Bump event row font/padding. Apply token fixes throughout wall mode JSX.

**Files:**
- Modify: `src/components/parent/WallHome.tsx`
- Modify: `src/components/parent/WallHome.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `WallHome.test.tsx`:

```tsx
it('does not render IntelligenceHeader in resting wall mode', async () => {
  render(
    <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
      <WallHome {...baseProps} isLocked={true} justWoke={false} />
    </DisplayContext.Provider>
  );
  // Wait for load
  await screen.findByTestId('wall-clock');
  expect(screen.queryByText('IntelligenceHeader')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm test fails**

```bash
pnpm vitest run src/components/parent/WallHome.test.tsx
```

Expected: FAIL — IntelligenceHeader is currently rendered in wall mode.

- [ ] **Step 3: Clean up right panel JSX**

In the wall mode `<main>` section, make these changes:

**a) Add `relative` to `<main>`:**
```tsx
// Before:
<main className="flex-1 overflow-y-auto px-8 xl:px-12 py-8 bg-white dark:bg-gray-950">

// After:
<main className="relative flex-1 overflow-y-auto px-8 xl:px-12 py-8 bg-white dark:bg-ui-dark">
```

**b) Remove from right panel (delete these lines entirely):**
```tsx
<IntelligenceHeader data={intelligence} onAddIngredients={handleAddIngredients} />

{(wallMode === 'morning' || wallMode === 'afterschool') && (
  <div className="mb-4">
    <PowerMissionCard mission={powerMission} isWallMode />
  </div>
)}

{wallMode !== 'night' && (
  <div className="mb-6">
    <GroceryChips items={frequentItems} onAdd={handleQuickAdd} isWallMode />
  </div>
)}
```

- [ ] **Step 4: Bump event row sizes and apply token fixes**

Find each event row `<div>` in the `dayGroups.map(...)` section. Apply these changes:

**Event card container:**
```tsx
// Before:
className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5"
// After:
className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-ui-soft"
```

**Event title:**
```tsx
// Before:
className="flex-1 text-lg font-semibold text-gray-900 dark:text-white truncate"
// After:
className="flex-1 text-xl font-bold text-ui-primary truncate"
```

**Event time:**
```tsx
// Before:
className="text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums"
// After:
className="text-base font-medium text-ui-muted tabular-nums"
```

**Assigned name:**
```tsx
// Before:
className="text-sm text-gray-500 dark:text-gray-400"
// After:
className="text-sm text-ui-muted"
```

**Homework card:**
```tsx
// Before:
className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10"
// After:
className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-amber-50"
```

**Homework title:**
```tsx
// Before:
className="text-lg font-semibold text-gray-900 dark:text-white truncate"
// After:
className="text-xl font-bold text-ui-primary truncate"
```

**Homework time label:**
```tsx
// Before:
className="text-sm font-medium text-amber-600 dark:text-amber-400"
// After:
className="text-base font-medium text-amber-600"
```

**"Nothing scheduled" text:**
```tsx
// Before:
className="text-sm text-gray-400 dark:text-gray-500 pl-2"
// After:
className="text-sm text-ui-muted-2 pl-2"
```

**Day header divider and label:**
```tsx
// Before (divider):
className="flex-1 h-px bg-gray-100 dark:border-gray-800"
// After:
className="flex-1 h-px bg-ui-soft"

// Before (label):
className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] shrink-0"
// After:
className="text-xs font-bold text-ui-muted-2 uppercase tracking-[0.15em] shrink-0"
```

**Left panel dividers:**
Replace `className="mx-8 h-px bg-gray-100 dark:border-gray-800"` with `className="mx-8 h-px bg-ui-soft"` (all instances in `<aside>`).

**Left panel background:**
```tsx
// Before:
<aside className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
// After:
<aside className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-ui-soft bg-white dark:bg-ui-dark">
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/components/parent/WallHome.test.tsx
```

Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/parent/WallHome.tsx src/components/parent/WallHome.test.tsx
git commit -m "feat: clean wall mode right panel, bump event row sizes, apply design tokens"
```

---

## Task 6: WallHome wake overlay integration

Wire `justWoke` prop → `showWakeOverlay` state → `AnimatePresence` + `WallWakeOverlay`. The overlay appears for 5s after screensaver wake and can be tapped to dismiss.

**Files:**
- Modify: `src/components/parent/WallHome.tsx`
- Modify: `src/components/parent/WallHome.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `WallHome.test.tsx`. First add this mock at module scope, alongside the other `vi.mock(...)` calls (lines 7–50), before `const baseProps`. Do NOT place it inside `describe` — `vi.mock` must be at module scope to be hoisted by Vitest:

```tsx
vi.mock('./WallWakeOverlay', () => ({
  WallWakeOverlay: () => <div data-testid="wall-wake-overlay">WakeOverlay</div>,
}));
```

Then add:

```tsx
it('shows WallWakeOverlay when justWoke is true in wall mode', async () => {
  render(
    <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
      <WallHome {...baseProps} isLocked={true} justWoke={true} />
    </DisplayContext.Provider>
  );
  expect(await screen.findByTestId('wall-wake-overlay')).toBeInTheDocument();
});

it('does not show WallWakeOverlay when justWoke is false', async () => {
  render(
    <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
      <WallHome {...baseProps} isLocked={true} justWoke={false} />
    </DisplayContext.Provider>
  );
  await screen.findByTestId('wall-clock');
  expect(screen.queryByTestId('wall-wake-overlay')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
pnpm vitest run src/components/parent/WallHome.test.tsx
```

Expected: 2 new tests fail.

- [ ] **Step 3: Add imports to WallHome**

At the top of `WallHome.tsx`, add:

```tsx
import { AnimatePresence } from 'motion/react';
import { WallWakeOverlay } from './WallWakeOverlay';
```

- [ ] **Step 4: Add showWakeOverlay state and effect**

Inside `WallHome`, after the existing state declarations, add:

```tsx
const [showWakeOverlay, setShowWakeOverlay] = useState(false);
useEffect(() => {
  if (justWoke) {
    setShowWakeOverlay(true);
    const t = setTimeout(() => setShowWakeOverlay(false), 5000);
    return () => clearTimeout(t);
  }
}, [justWoke]);
```

- [ ] **Step 5: Render WallWakeOverlay inside the right `<main>`**

Inside the wall mode `<main>` (the `relative` one from Task 5), add `AnimatePresence` + `WallWakeOverlay` as the first child:

```tsx
<main className="relative flex-1 overflow-y-auto px-8 xl:px-12 py-8 bg-white dark:bg-ui-dark">
  <AnimatePresence>
    {showWakeOverlay && (
      <WallWakeOverlay
        onDismiss={() => setShowWakeOverlay(false)}
        intelligence={intelligence}
        powerMission={powerMission}
        frequentItems={frequentItems}
        wallMode={wallMode}
        onAddIngredients={handleAddIngredients}
        onQuickAdd={handleQuickAdd}
      />
    )}
  </AnimatePresence>

  {/* ... existing error banner, dayGroups, leaderboard ... */}
</main>
```

- [ ] **Step 6: Run all tests**

```bash
pnpm vitest run src/components/parent/WallHome.test.tsx src/components/parent/WallWakeOverlay.test.tsx
```

Expected: all 8 WallHome tests and 6 WallWakeOverlay tests pass (14 total).

- [ ] **Step 7: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass. Check for any TypeScript errors:

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/parent/WallHome.tsx src/components/parent/WallHome.test.tsx
git commit -m "feat: show WallWakeOverlay for 5s after screensaver wake in wall mode"
```

---

## Verification

After all tasks complete, verify the full feature manually:

1. Start dev server: `pnpm dev`
2. Log in as a parent, switch to wall mode (lock the screen)
3. Confirm left panel shows avatar cards for kids (not progress bars)
4. Click a kid card — verify it expands to show individual tasks
5. Confirm right panel shows only agenda (no IntelligenceHeader/GroceryChips/PowerMission)
6. Confirm event text is noticeably larger than before
7. Wait for screensaver (or trigger preview in Settings → Screensaver → Preview)
8. Tap screensaver — verify overlay fades in with IntelligenceHeader/contextual content
9. Wait 5s — verify overlay auto-fades
10. Tap overlay manually — verify it dismisses immediately

Run full test suite one final time:

```bash
pnpm test && pnpm lint
```
