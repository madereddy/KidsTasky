# Wall/Kiosk Skylight Redesign — P0 + P1 Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix calendar infinite skeleton, force light theme in wall/kiosk mode, add wall mode entry from Home, hide chrome in kiosk, deprecate CalendarWallView in favor of WallHome wall mode.

**Architecture:** DisplayContext gets `isKioskMode`; App.tsx hides nav when kiosk; WallHome gains wall-toggle button and forces light theme unconditionally; CalendarView no longer routes to CalendarWallView; useCalendarData loading is made robust with cancellation.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Socket.IO, Vite, Vitest, pnpm

---

## File Map

| File | Change |
|------|--------|
| `src/contexts/DisplayContext.tsx` | Add `isKioskMode: boolean` |
| `src/App.tsx` | Wire `isKioskMode` into context; hide AppHeader+BottomNav in kiosk; add `onToggleWall` to WallHome |
| `src/components/parent/WallHome.tsx` | Force light theme; remove "Manage" in kiosk; accept `onToggleWall`; show Wall button on desktop; add countdown chips to right panel |
| `src/components/calendar/hooks/useCalendarData.ts` | Add `cancelled` cleanup ref; make loading always clears ≤ 2s |
| `src/components/calendar/CalendarView.tsx` | Remove CalendarWallView branch; wall toggle in Calendar stays but goes to standard view |
| `src/components/shared/AppHeader.tsx` | Consume `isKioskMode` from context, return null when true |
| `src/components/shared/BottomNav.tsx` | Same — hide in kiosk |

---

## Task 1: Fix P0 — useCalendarData loading never clears

**Files:**
- Modify: `src/components/calendar/hooks/useCalendarData.ts:79-127`

- [ ] **Step 1:** Add `cancelled` ref and cleanup to the init effect so stale setLoading calls are dropped; reduce safety timer to 2s

```typescript
useEffect(() => {
  let cancelled = false;
  const init = async () => {
    if (isInitialMount.current) {
      if (!cancelled) setLoading(true);
      isInitialMount.current = false;
    }
    // Safety net: always clear loading within 2s regardless of API state
    const timer = setTimeout(() => { if (!cancelled) setLoading(false); }, 2000);
    try {
      await Promise.allSettled([
        fetchEvents(),
        listsClientService.getLists(parentId).then((lists) => {
          if (!cancelled) setRoutineLists((lists || []).filter((list) => list.category === 'routine'));
        }),
        settingsClientService.getCalendars(parentId).then((v) => { if (!cancelled) setSyncCalendars(v); }),
        settingsClientService.getCalendarVisibility().then(rows => {
          if (!cancelled) {
            const map: Record<string, boolean> = {};
            if (Array.isArray(rows)) rows.forEach(r => map[r.calendarId] = Number(r.isVisible) === 1);
            setCalendarVisibility(map);
          }
        }),
        settingsClientService.getSettings(parentId).then((settings) => {
          if (!settings || cancelled) return;
          setTimezone(settings.timezone || 'America/Chicago');
          setTemperatureUnit((settings.temperatureUnit as TemperatureUnitPref) || 'celsius');
          setTimeFormat((settings.timeFormat as TimeFormatPref) || '12h');
          if (typeof settings.locationLat === 'number' && typeof settings.locationLon === 'number') {
            weatherClientService.getForecast(settings.locationLat, settings.locationLon)
              .then(wx => { if (!cancelled) setForecast(wx || []); })
              .catch(() => {});
          }
        })
      ]);
      if (isWallMode && !cancelled) await fetchWallData();
    } catch (err) {
      clientLogger.errorWithException('calendar_initialization_failed', err, { parentId });
    } finally {
      clearTimeout(timer);
      if (!cancelled) setLoading(false);
    }
  };
  init();
  return () => { cancelled = true; };
}, [parentId, fetchEvents, isWallMode, fetchWallData]);
```

- [ ] **Step 2:** Run `pnpm lint` — verify no type errors
- [ ] **Step 3:** Commit `fix(calendar): robust loading cleanup — 2s safety timer + cancelled ref`

---

## Task 2: Fix P0 — Remove CalendarWallView branch from CalendarView

**Files:**
- Modify: `src/components/calendar/CalendarView.tsx:232-263`

- [ ] **Step 1:** Delete the `if (isWallMode) { return <CalendarWallView ...> }` block entirely. When user toggles "Wall" in CalendarStandardView toolbar, it now sets `isWallMode` but falls through to `CalendarStandardView` (which has wall filter controls baked in). CalendarWallView is no longer rendered anywhere.

- [ ] **Step 2:** Remove `CalendarWallView` import from CalendarView.tsx

- [ ] **Step 3:** Verify `pnpm lint` passes

- [ ] **Step 4:** Commit `feat(calendar): deprecate CalendarWallView — standard view is the only calendar surface`

---

## Task 3: Add isKioskMode to DisplayContext

**Files:**
- Modify: `src/contexts/DisplayContext.tsx`

- [ ] **Step 1:** Add `isKioskMode` to context interface and default value:

```typescript
export interface DisplayContextValue {
  isWallMode: boolean;
  isSleepMode: boolean;
  isKioskMode: boolean;
}

export const DisplayContext = createContext<DisplayContextValue>({
  isWallMode: false,
  isSleepMode: false,
  isKioskMode: false,
});
```

- [ ] **Step 2:** Modify `src/App.tsx` — add `isKioskMode` state and pass to DisplayContext:
  - Add `const [isKioskMode, setIsKioskMode] = useState(false);`
  - Change DisplayContext.Provider value to `{ isWallMode: isLocked, isSleepMode, isKioskMode }`
  - Pass `isKioskMode` and `setIsKioskMode` down to `WallHome` via props

- [ ] **Step 3:** In `AppHeader.tsx` — read `isKioskMode` from context, return null if true

- [ ] **Step 4:** In `BottomNav.tsx` — same pattern

- [ ] **Step 5:** `pnpm lint`

- [ ] **Step 6:** Commit `feat(display): add isKioskMode to DisplayContext — hides nav chrome`

---

## Task 4: Force light theme in WallHome wall mode

**Files:**
- Modify: `src/components/parent/WallHome.tsx:304`

- [ ] **Step 1:** Change the wall mode root div to force light theme unconditionally:

```tsx
// Before:
<div className="flex overflow-hidden bg-white dark:bg-ui-dark" style={{ minHeight: 'calc(100vh - 80px)' }}>

// After:
<div className="flex overflow-hidden" style={{ minHeight: 'calc(100vh - 80px)', background: '#ffffff', color: '#0f172a' }}>
```

Also change left panel and right panel to remove `dark:` variants:
- `bg-white dark:bg-ui-dark` → `bg-white` (in left aside, line 311)
- `bg-white dark:bg-ui-dark` → `bg-white` (in right main, line 439)

- [ ] **Step 2:** Remove "Manage family →" button when `isKioskMode` (read from context):

```tsx
{!isKioskMode && (
  <div className="px-8 pb-6 mt-auto pt-4">
    <button onClick={onManage} className="text-xs text-ui-muted hover:text-ui-primary transition-colors">
      Manage family →
    </button>
  </div>
)}
```

- [ ] **Step 3:** Verify light text still readable (text-ui-primary resolves to dark color in light theme)

- [ ] **Step 4:** Commit `fix(wall): force light theme in wall mode, hide manage link in kiosk`

---

## Task 5: Add wall entry point to Home + countdown chips

**Files:**
- Modify: `src/App.tsx` — pass `onToggleWall` and `onToggleKiosk` to WallHome
- Modify: `src/components/parent/WallHome.tsx` — show wall toggle button in normal mode + countdown chips in wall right panel

- [ ] **Step 1:** In WallHome.tsx normal mode (non-wall branch, line 556+), add "Wall Display" button at the top:

```tsx
<div className="flex items-center justify-between mb-4">
  <h1 className="text-xl font-bold text-ui-primary">Home</h1>
  {onToggleWall && (
    <button
      onClick={onToggleWall}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ui-soft border border-ui text-sm font-semibold text-ui-secondary hover:bg-ui-soft-3 transition-colors"
    >
      <MonitorSmartphone size={16} /> Wall Display
    </button>
  )}
</div>
```

- [ ] **Step 2:** Add countdown chips section to WallHome wall mode right panel (above day groups):

```tsx
{/* Countdown events */}
{(() => {
  const nowMs = Date.now();
  const countdownEvts = events
    .filter(e => Boolean(e.isCountdown) && e.startTime > nowMs)
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 3);
  if (countdownEvts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mb-8">
      {countdownEvts.map(e => {
        const daysLeft = Math.ceil((e.startTime - nowMs) / (1000 * 60 * 60 * 24));
        return (
          <div key={e.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-ui-soft border border-ui">
            <div className="text-2xl font-black tabular-nums" style={{ color: e.color || '#6366f1' }}>{daysLeft}</div>
            <div>
              <div className="text-xs font-bold text-ui-muted-2 uppercase tracking-wide">days</div>
              <div className="text-sm font-semibold text-ui-primary">{e.title}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
})()}
```

- [ ] **Step 3:** Add `MonitorSmartphone` to WallHome.tsx imports from `lucide-react`

- [ ] **Step 4:** Add `onToggleWall?: () => void` and `onToggleKiosk?: () => void` to WallHome Props interface

- [ ] **Step 5:** In App.tsx, pass `onToggleWall={() => setIsLocked(true)}` to WallHome — this sets `isLocked = true` which means `isWallMode = true` in DisplayContext

- [ ] **Step 6:** `pnpm lint`

- [ ] **Step 7:** Commit `feat(wall): add Wall Display entry from Home + countdown chips in wall mode`

---

## Task 6: Wire kiosk exit in WallHome wall mode

**Files:**
- Modify: `src/components/parent/WallHome.tsx` — add floating exit button in wall mode when kiosk

- [ ] **Step 1:** Add floating "Exit" button bottom-right in wall mode when `isKioskMode`:

```tsx
{isKioskMode && (
  <button
    onClick={() => {/* needs onExitKiosk prop */}}
    className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-black/60 text-white rounded-full text-xs font-bold backdrop-blur-sm"
  >
    Exit
  </button>
)}
```

- [ ] **Step 2:** In App.tsx, add "Kiosk" button to pass `onToggleKiosk`. When activated: `setIsKioskMode(true)`, `setIsLocked(true)`, request fullscreen. Add `onExitKiosk: () => { setIsKioskMode(false); setIsLocked(false); exitFullscreen(); }` to WallHome.

- [ ] **Step 3:** `pnpm lint && pnpm test`

- [ ] **Step 4:** Commit `feat(wall): kiosk mode entry/exit from WallHome`

---

## Acceptance Criteria

- Calendar tab: skeleton clears in ≤ 2 seconds always
- Home page: "Wall Display" button visible for parents on desktop
- Wall mode: white background, no dark variants, huge clock, chore cards, countdown chips
- Kiosk mode: AppHeader + BottomNav hidden, fullscreen, "Exit" button fixed bottom-right
- CalendarWallView: no longer rendered (can be deleted in follow-up)
