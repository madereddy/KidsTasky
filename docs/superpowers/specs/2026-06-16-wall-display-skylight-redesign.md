# Wall Display — Skylight-Inspired Redesign

**Date:** 2026-06-16  
**Scope:** `WallHome.tsx` wall mode only (`isWallMode === true`). No changes to mobile/parent dashboard.

---

## Goal

Make the wall display feel like Skylight Calendar: large text legible from across a room, clean whitespace, prominent kid chore status, agenda as the hero content. Targets both tablet (10–15", touch) and TV (40"+, glance-only) via responsive sizing.

---

## Problems Being Fixed

1. Kid chore section shows only progress bars — not enough info, hard to read at distance
2. Agenda text too small (`text-lg`) for wall viewing
3. IntelligenceHeader / GroceryChips / PowerMissionCard clutter the resting state
4. Raw `gray-*` Tailwind classes used instead of design-system tokens
5. Touch targets too small for tablet wall use

---

## Design

### Left Panel (widen: `w-72 xl:w-80`)

Contains only three things — clock, weather, kid chore cards. Nothing else.

**Clock** — update `SkyLiveClock` to use semantic tokens (same size/style, token fixes only):
- `text-gray-900 dark:text-white` → `text-ui-primary`
- `text-gray-400 dark:text-gray-500` → `text-ui-muted-2`
- `text-gray-600 dark:text-gray-300` → `text-ui-secondary`

Note: this codebase uses **class-based dark mode** via `.theme-dark` (defined in `index.css` line 4 as `@custom-variant dark (&:where(.theme-dark, .theme-dark *))`). Do NOT add `dark:` prefixed variants. Use bare semantic token classes — the `.theme-dark` overrides in `index.css` lines 195–203 automatically remap them for dark mode.

**Weather** — keep current layout. Replace `text-gray-500` → `text-ui-muted`, `bg-gray-100` → `bg-ui-soft-2`.

**Kid Chore Cards** (replaces progress bars):

Data sources already available from `useWallHomeController`:
- `tasksByKid[kid.uid]` — array of `Task` objects for that kid
- `completionsByKid[kid.uid]` — array of `TaskCompletion` objects for today
- Build `completedTaskIds = new Set(completions.map(c => c.taskId))` to check done status

Each kid gets a card with two states. Single `expandedKidId: string | null` state in `WallHome`; `setExpandedKidId(id === expandedKidId ? null : id)` on click.

_Collapsed (default):_
```
┌─────────────────────────────────────┐  ← border-2 border-ui (pending) or border-emerald-500 (all done)
│  [Avatar]  Emma          [badge: 2] │  ← min-h-[64px]
│            2 of 4 done              │
└─────────────────────────────────────┘
```
- Avatar: 40×40px colored circle (`memberColor` bg), kid's initial, `text-white font-bold`
- Subtitle: `text-ui-muted text-xs` — "2 of 4 done" or "All done!" (emerald when complete)
- Badge (right): amber circle `bg-amber-100 text-amber-700 font-bold text-sm` showing remaining count; swap to `bg-emerald-100 text-emerald-700` with `✓` when all done

_Expanded (tap to toggle):_
```
┌─────────────────────────────────────┐
│  [Avatar]  Emma          [badge: 2] │
│            2 of 4 done              │
├─ task rows ─────────────────────────┤
│  ✓  Make bed          (struck, muted)│
│  ○  Dishes                          │
│  ○  Take out trash                  │
└─────────────────────────────────────┘
```
- Render `tasksByKid[kid.uid].filter(t => t.status !== 'archived')` sorted by creation order
- Done circle: `w-[18px] h-[18px] rounded-full border-2 border-emerald-500 bg-emerald-50 flex items-center justify-center` with `✓` in `text-emerald-600 text-[10px]`
- Pending circle: `w-[18px] h-[18px] rounded-full border-2 border-indigo-400`
- Done task text: `line-through text-ui-muted-2 text-xs`
- Pending task text: `text-ui-primary font-medium text-xs`
- Task rows indented `pl-[52px]` to align under kid name

---

### Right Panel (agenda only)

Wrap the right `<main>` in `relative` positioning so the wake overlay can `absolute`-position over it.

Remove from resting wall state:
- `<IntelligenceHeader />` — move to wake overlay
- `<PowerMissionCard />` — move to wake overlay  
- `<GroceryChips />` — move to wake overlay

Keep:
- Day group sections (Today / Tomorrow / Wed, Jun 19 / etc.)
- FamilyLeaderboard (afterschool / evening wallMode)
- Error banner

**Event row size bumps:**
| Before | After |
|--------|-------|
| `text-lg` title | `text-xl font-bold` |
| `py-3` padding | `py-4` |
| `rounded-xl` | `rounded-2xl` |
| `text-sm` time | `text-base` |

**Token fixes on event rows (bare tokens only — no `dark:` prefix):**
- `bg-gray-50 dark:bg-white/5` → `bg-ui-soft`
- `border-gray-100 dark:border-gray-800` → `border-ui-soft`
- `text-gray-400 dark:text-gray-500` → `text-ui-muted-2`
- `text-gray-900 dark:text-white` → `text-ui-primary`
- `text-gray-500 dark:text-gray-400` → `text-ui-muted`

**Homework row:** same size bumps, keep amber color.

---

### Wake Overlay (`src/components/parent/WallWakeOverlay.tsx`)

Appears for 5 seconds after the photo screensaver dismisses, then fades out. Shows the contextual content that was removed from the resting state.

**Trigger:** `justWoke` boolean prop passed from `App.tsx`. Do NOT watch `isSleepMode` — `isSleepMode` tracks the `SleepModeOverlay` (the scheduled-sleep lock), not the `PhotoScreensaver`. The screensaver has its own idle timer and is a separate system.

**Root cause gap:** `PhotoScreensaver.tsx` currently calls `onDismiss?.()` only when `forceIdle` (preview mode). On normal user-initiated dismiss (user taps photo screensaver), it calls internal `setIsIdle(false)` but never surfaces to `App.tsx`. Fix this first (see Files Changed).

**Full signal chain:**

1. `PhotoScreensaver.tsx` — call `onDismiss?.()` on user-initiated dismiss in all modes (not just preview). Move the `onDismiss?.()` call outside the `forceIdle` guard.

2. `App.tsx` — add `wallJustWoke` state:
```tsx
const [wallJustWoke, setWallJustWoke] = useState(false);
```
Update `<PhotoScreensaver>` `onDismiss` prop (currently `App.tsx` line 399):
```tsx
onDismiss={() => {
  if (screensaverPreview) {
    setScreensaverPreview(false);
  } else {
    setWallJustWoke(true);
  }
}}
```
Pass to `<WallHome>` (line 336) — add `justWoke={wallJustWoke}`:

3. `WallHome` — new prop `justWoke: boolean`, local timeout clears overlay:
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
`App.tsx` does not need to clear `wallJustWoke` — `WallHome` owns the display timeout independently. `wallJustWoke` acts as a pulse: once set true it stays true (or resets on next screensaver wake), but `showWakeOverlay` auto-clears after 5s.

Note: scheduled-sleep wake (user dismisses `SleepModeOverlay`) does NOT trigger the overlay — correct, since that is a different UX gesture and the meal/grocery context is less relevant there.

**Layout:**
```
┌──────────────────────────────────────────┐  ← absolute, over right panel
│  [IntelligenceHeader]                    │
│  [PowerMissionCard if morning/afterschool]│
│  [GroceryChips if not night]             │
└──────────────────────────────────────────┘
```

- Position: `absolute inset-x-0 top-0 z-10` inside the `relative`-positioned right `<main>`
- Background: `bg-white/90 backdrop-blur-sm border-b border-ui-soft` (NOT `glass-panel` — that utility uses a dark navy bg; NOT `bg-white/95` — the `.theme-dark .bg-white` bridge in `index.css` lines 208–212 covers `/90` through `/50` but NOT `/95`, so `/95` would render near-opaque white on dark-themed displays; `/90` is covered and correct)
- Animate: `motion/react` `AnimatePresence` with `initial={{ opacity: 0, y: -8 }}` / `animate={{ opacity: 1, y: 0 }}` / `exit={{ opacity: 0, y: -8 }}`, `transition={{ duration: 0.4 }}`
- Auto-dismiss: `setTimeout(5000)` in the `justWoke` effect above
- Tap to dismiss early: `WallWakeOverlay` receives `onDismiss: () => void` prop; `WallHome` passes `onDismiss={() => setShowWakeOverlay(false)}`; overlay root div has `onClick={onDismiss}` (`justWoke` is a read-only prop, so `setShowWakeOverlay` in `WallHome` is the correct setter)

---

### Design Token Compliance

This codebase uses **class-based dark mode** via `.theme-dark`, not Tailwind's `dark:` media variant. Use bare semantic token classes throughout — never add `dark:` prefixes to these tokens.

| Old (remove) | New (use) |
|---|---|
| `text-gray-900 dark:text-white` | `text-ui-primary` |
| `text-gray-700 dark:text-gray-300` | `text-ui-secondary` |
| `text-gray-500 dark:text-gray-400` | `text-ui-muted` |
| `text-gray-400 dark:text-gray-500` | `text-ui-muted-2` |
| `bg-gray-50 dark:bg-white/5` | `bg-ui-soft` |
| `bg-gray-100 dark:bg-gray-800` | `bg-ui-soft-2` |
| `border-gray-100 dark:border-gray-800` | `border-ui-soft` |
| `bg-white dark:bg-gray-950` (panel bg) | `bg-white dark:bg-ui-dark` |

Font: Nunito Sans is already the global default — no change needed.

---

### Touch Targets

`wall.css` already sets `button { min-height: 56px }`. Kid chore cards are `<div>` not `<button>`, so add `min-h-[64px]` directly. Event rows with `py-4` + `text-xl` naturally hit ~60px.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/parent/WallHome.tsx` | Add `justWoke: boolean` prop. Left panel: widen to `w-72 xl:w-80`, swap progress bars → expandable kid cards, token-fix `SkyLiveClock`. Right panel: add `relative` on `<main>`, remove IntelligenceHeader/GroceryChips/PowerMission from resting state, add `showWakeOverlay` state + `<WallWakeOverlay>`. Token fixes throughout wall mode JSX. Event row size bumps. |
| `src/components/parent/WallWakeOverlay.tsx` | New component. Props: `onDismiss: () => void` + data props forwarded from `WallHome` (intelligence, powerMission, frequentItems, wallMode, onAddIngredients, onQuickAdd). Light-frosted overlay (`bg-white/90 backdrop-blur-sm`) with IntelligenceHeader + PowerMissionCard + GroceryChips. Root div `onClick={onDismiss}` for early dismiss. |
| `src/components/shared/PhotoScreensaver.tsx` | Call `onDismiss?.()` on user-initiated dismiss in all modes (currently only fires in `forceIdle`/preview mode). Move `onDismiss?.()` outside the `forceIdle` guard. |
| `src/App.tsx` | Add `wallJustWoke` state. Update `<PhotoScreensaver onDismiss>` to set `wallJustWoke = true` on non-preview dismiss. Pass `justWoke={wallJustWoke}` to `<WallHome>` at line 336. |

No changes to: `wall.css`, `index.css`, non-wall render path, mobile views, KidDashboard.

---

## Out of Scope

- Kid dashboard (mobile) — separate effort
- Screensaver / sleep mode transition animations — already implemented
- Calendar / homework views
- Any backend changes
