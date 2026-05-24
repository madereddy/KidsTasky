# Plan 03 — Family Settings UI

**Group:** A (no dependencies, start immediately)
**Blocks:** Plans 06, 07, 09

---

## Problem

`FamilySettings` schema exists in the DB (`family_settings` table) and the `FamilySettings` type is defined, but there are no settings routes and no UI. Weather (Plan 06) needs lat/lon from settings. Parental lock (Plan 09) needs the lock flag. Photo manager (Plan 07) lives inside settings. Without this, none of those features are configurable.

---

## What Already Exists

- `FamilySettings` type: `{ parentId, locationLat, locationLon, timezone, pin?, sleepStart?, sleepEnd? }`
- `family_settings` table in DB (migration 006)
- `PinPad.tsx` component — reuse for PIN management display

---

## Database

No migration needed. Add `isLocked` for Plan 09 in that plan's migration.

---

## Files to Create

### `src/server/modules/settings/routes.ts`

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { settingsService } from './service.js';

export const settingsRouter = Router();

settingsRouter.get('/settings/:parentId', requireAuth, (req, res) => {
  const settings = settingsService.getSettings(req.params.parentId);
  res.json(settings);
});

settingsRouter.put('/settings/:parentId', requireAuth, (req, res) => {
  settingsService.saveSettings(req.params.parentId, req.body);
  res.json({ success: true });
});
```

### `src/server/modules/settings/service.ts`

```ts
import { db } from '../../db.js';
import { FamilySettings } from '../../../types.js';

const DEFAULTS: Partial<FamilySettings> = {
  locationLat: 37.7749,
  locationLon: -122.4194,
  timezone: 'America/Chicago',
  sleepStart: '21:00',
  sleepEnd: '07:00',
};

export const settingsService = {
  getSettings: (parentId: string): FamilySettings => {
    const row = db.prepare('SELECT * FROM family_settings WHERE parentId = ?').get(parentId) as FamilySettings | undefined;
    return row ?? { ...DEFAULTS, parentId } as FamilySettings;
  },
  saveSettings: (parentId: string, data: Partial<FamilySettings>) => {
    db.prepare(`
      INSERT INTO family_settings (parentId, locationLat, locationLon, timezone, pin, sleepStart, sleepEnd)
      VALUES (@parentId, @locationLat, @locationLon, @timezone, @pin, @sleepStart, @sleepEnd)
      ON CONFLICT(parentId) DO UPDATE SET
        locationLat = excluded.locationLat,
        locationLon = excluded.locationLon,
        timezone = excluded.timezone,
        pin = excluded.pin,
        sleepStart = excluded.sleepStart,
        sleepEnd = excluded.sleepEnd
    `).run({ parentId, ...DEFAULTS, ...data });
  }
};
```

### `src/services/settings.ts`

```ts
import { fetchAPI } from './http';
import { FamilySettings } from '../types';

export const settingsClientService = {
  getSettings: (parentId: string): Promise<FamilySettings> =>
    fetchAPI(`/settings/${parentId}`),
  saveSettings: (parentId: string, data: Partial<FamilySettings>): Promise<{ success: boolean }> =>
    fetchAPI(`/settings/${parentId}`, { method: 'PUT', body: JSON.stringify(data) }),
};
```

### `src/components/parent/SettingsView.tsx`

Full-page slide-over panel (fixed right-side drawer, same pattern as ListSidebar).

**Sections:**

**Location**
- Text input: "City or coordinates"
- "Detect my location" button → `navigator.geolocation.getCurrentPosition()` → stores lat/lon
- Display current lat/lon below in small text
- Note: plain text entry is for manual override; for MVP just store raw lat/lon from geolocation or manual input

**Timezone**
```tsx
<select value={settings.timezone} onChange={...}>
  {Intl.supportedValuesOf('timeZone').map(tz => (
    <option key={tz} value={tz}>{tz}</option>
  ))}
</select>
```

**Sleep Hours**
- Two `<input type="time">` side by side: "Bedtime" (`sleepStart`) and "Wake time" (`sleepEnd`)
- These control when `SleepModeOverlay` activates

**Family PIN**
- Current PIN: masked display (dots)
- "Change PIN" button → reveals a 4-digit input
- Saves via `saveSettings`

**Save button** → calls `settingsClientService.saveSettings(parentId, formState)`

**Props:** `parentId: string`, `onClose: () => void`

---

## Files to Modify

### `src/server/routes.ts`
Import and register settings router:
```ts
import { settingsRouter } from './modules/settings/routes.js';
// ...
router.use('/api', settingsRouter);
```

### `src/App.tsx` or `ParentDashboard.tsx`
- Add a gear icon (⚙️ / `Settings` from lucide) to the parent header
- `useState<boolean>` for `showSettings`
- Render `<SettingsView parentId={profile.uid} onClose={() => setShowSettings(false)} />` when open
- Fetch and store `FamilySettings` in App state so it can be passed to CalendarView (Plan 06) and SleepModeOverlay

---

## Notes

- `settingsRouter` filename collision: there's currently a `GET /settings/:parentId/connections` route in an existing file. Check `src/server/routes.ts` to confirm routing order — the new settings routes should not shadow the connections route.
- The connections route is at `/settings/:parentId/connections` — the new settings routes are at `/settings/:parentId` (exact match). No collision as long as `connections` route is registered first or the router uses exact matching.

---

## Acceptance Criteria

- [ ] Settings panel opens from a gear icon in the parent header
- [ ] Location can be set via browser geolocation or manual lat/lon
- [ ] Timezone selector shows all IANA timezones
- [ ] Sleep hours save and persist
- [ ] PIN can be changed and saves correctly
- [ ] Settings survive page reload (stored in DB)
- [ ] `GET /settings/:parentId` returns defaults if no row exists yet
