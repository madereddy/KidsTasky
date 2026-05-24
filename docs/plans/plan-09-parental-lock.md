# Plan 09 — Parental Lock Mode

**Group:** C (requires Plan 03)
**Blocked by:** Plan 03 (lock flag lives in FamilySettings; PIN managed via SettingsView)

---

## Problem

Any device showing the app can edit events, add tasks, and delete content. Skylight lets parents lock the display so shared screens (TV, tablet on the wall) show the calendar in read-only mode. Kids and guests can view the schedule but cannot modify it. Unlocking requires the family PIN.

---

## What Already Exists

- `FamilySettings` has `pin?: string` — the family PIN
- `PinPad.tsx` — a full numeric PIN entry component (reuse directly)
- `SettingsView.tsx` (Plan 03) — where "Lock Display" toggle will live
- `family_settings` table in DB

---

## Database

### Migration `016_add_parental_lock.sql`
Create at `src/server/migrations/016_add_parental_lock.sql`:

```sql
ALTER TABLE family_settings ADD COLUMN isLocked INTEGER NOT NULL DEFAULT 0;
```

---

## Files to Modify

### `src/types.ts`
Add to `FamilySettings`:
```ts
isLocked?: boolean;
```

### `src/server/modules/settings/service.ts` (from Plan 03)
Add lock toggle:
```ts
setLocked: (parentId: string, isLocked: boolean) => {
  db.prepare('UPDATE family_settings SET isLocked = ? WHERE parentId = ?')
    .run(isLocked ? 1 : 0, parentId);
},
```

### `src/server/modules/settings/routes.ts` (from Plan 03)
Add lock/unlock endpoints:

```ts
settingsRouter.post('/settings/:parentId/lock', requireAuth, (req, res) => {
  settingsService.setLocked(req.params.parentId, true);
  res.json({ success: true });
});

// Unlock requires PIN verification
settingsRouter.post('/settings/:parentId/unlock', requireAuth, (req, res) => {
  const settings = settingsService.getSettings(req.params.parentId);
  if (!settings.pin) {
    // No PIN set — unlock without verification
    settingsService.setLocked(req.params.parentId, false);
    return res.json({ success: true });
  }
  const { pin } = req.body;
  if (pin !== settings.pin) {
    return res.status(403).json({ error: 'Incorrect PIN' });
  }
  settingsService.setLocked(req.params.parentId, false);
  res.json({ success: true });
});
```

Note: `settings.pin` is stored as plaintext here (set via the SettingsView PIN input). If the existing PIN is bcrypt-hashed (check `013_add_app_password_and_pin_helpers.sql`), use `bcrypt.compare(pin, settings.pin)` instead of direct comparison.

### `src/services/settings.ts` (from Plan 03)
Add:
```ts
lockDisplay: (parentId: string): Promise<void> =>
  fetchAPI(`/settings/${parentId}/lock`, { method: 'POST' }),
unlockDisplay: (parentId: string, pin: string): Promise<{ success: boolean }> =>
  fetchAPI(`/settings/${parentId}/unlock`, { method: 'POST', body: JSON.stringify({ pin }) }),
```

### `src/components/parent/SettingsView.tsx` (from Plan 03)
Add "Display Lock" section:

```tsx
<section>
  <h3 className="text-lg font-semibold mb-2">Display Lock</h3>
  <p className="text-sm text-gray-500 mb-4">
    Lock this screen so visitors can view the calendar but cannot make changes.
    Unlocking requires the family PIN.
  </p>
  <button
    onClick={handleLockDisplay}
    className="bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold"
  >
    Lock Display Now
  </button>
</section>
```

`handleLockDisplay` → calls `settingsClientService.lockDisplay(parentId)` → closes settings panel → triggers lock state in App.

### `src/App.tsx`
This is where lock state is managed:

```tsx
const [isLocked, setIsLocked] = useState(false);

// On mount, after fetching settings:
useEffect(() => {
  if (settings?.isLocked) setIsLocked(true);
}, [settings]);

// Inactivity timer: re-lock after 10 minutes of no interaction
useEffect(() => {
  if (!isLocked) {
    const timer = setTimeout(() => setIsLocked(true), 10 * 60 * 1000);
    return () => clearTimeout(timer);
  }
}, [isLocked]);
// Reset timer on interaction (mouse/keyboard/touch) — same pattern as PhotoScreensaver

// Render overlay when locked:
{isLocked && (
  <ParentalLockOverlay
    parentId={profile.uid}
    onUnlock={() => setIsLocked(false)}
  />
)}
```

Pass `isLocked` as prop to `CalendarView` and `ParentDashboard` to suppress edit controls.

### `src/components/calendar/CalendarView.tsx` (from Plan 01)
Accept `isLocked?: boolean` prop. When true:
- Hide the "+ Add Event" button
- Hide delete/edit buttons on event chips
- Show a small "🔒 View only" badge in the header

### `src/components/parent/ParentDashboard.tsx`
Accept `isLocked?: boolean` prop. When true:
- Hide "New Objective" button
- Hide archive/delete buttons on task cards
- Show a read-only banner at the top

---

## Files to Create

### `src/components/shared/ParentalLockOverlay.tsx`

Full-screen overlay that blocks interaction and prompts for PIN.

```tsx
import React, { useState } from 'react';
import { PinPad } from '../parent/PinPad';
import { settingsClientService } from '../../services/settings';
import { Lock } from 'lucide-react';

interface Props {
  parentId: string;
  onUnlock: () => void;
}

export function ParentalLockOverlay({ parentId, onUnlock }: Props) {
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');

  const handlePinComplete = async (enteredPin: string) => {
    try {
      await settingsClientService.unlockDisplay(parentId, enteredPin);
      onUnlock();
    } catch {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-3 text-white">
        <Lock className="w-12 h-12 text-slate-400" />
        <h2 className="text-2xl font-bold">Display Locked</h2>
        <p className="text-slate-400 text-sm">Enter the family PIN to unlock</p>
      </div>
      <PinPad
        value={pin}
        onChange={setPin}
        onComplete={handlePinComplete}
      />
      {error && <p className="text-rose-400 text-sm">{error}</p>}
    </div>
  );
}
```

Note: check the `PinPad.tsx` props API — adjust `onChange`/`onComplete` to match its actual interface.

---

## Auto-Relock Behavior

- Re-lock triggers after 10 minutes of inactivity (same idle detection as PhotoScreensaver)
- Alternatively: re-lock when the app regains focus after being hidden (`document.visibilitychange`)
- Parent who explicitly unlocked can re-lock manually via "Lock Display" in Settings

---

## Acceptance Criteria

- [ ] "Lock Display" button in settings immediately shows the lock overlay
- [ ] Lock overlay blocks all interaction with the app beneath it
- [ ] Entering the correct PIN dismisses the overlay
- [ ] Entering the wrong PIN shows an error and resets the PIN input
- [ ] App re-locks automatically after 10 minutes of inactivity
- [ ] In locked mode, all edit/delete/add controls are hidden (not just overlay-blocked)
- [ ] If no PIN is set, unlocking succeeds without requiring PIN entry
- [ ] Lock state persists in DB so it survives a page reload on a shared device
