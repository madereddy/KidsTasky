# Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all architectural debt identified in code review: extract SettingsView controller hook, move raw db calls out of route files into services, kill runtime schema branching in sync service, and split the 161-line syncGoogleConnectionNow god function.

**Architecture:** Route files handle HTTP only (parse, validate, respond). Service files own all DB access and business logic. React components own JSX only; hooks own state and async logic. Each unit is independently testable.

**Tech Stack:** React 19, TypeScript, Express 5, SQLite (better-sqlite3), Vitest, supertest, pnpm

---

## File Map

**New files:**
- `src/hooks/useSettingsController.ts` — all state + async logic extracted from SettingsView

**Modified files:**
- `src/components/parent/SettingsView.tsx` — pure JSX shell, calls `useSettingsController`
- `src/server/modules/tasks/service.ts` — add `getFamilyMembers`, `getPowerMission`
- `src/server/modules/tasks/routes.ts` — remove raw `db.` calls (lines 323, 353, 360, 362)
- `src/server/modules/events/service.ts` — add `assertFamilyMember`
- `src/server/modules/events/routes.ts` — remove raw `db.` call (line 123)
- `src/server/modules/photos/service.ts` — add `getPhotoParentId`
- `src/server/modules/photos/routes.ts` — remove raw `db.` calls (lines 34, 152, 163, 301)
- `src/server/modules/notes/service.ts` — add `getUserName`
- `src/server/modules/notes/routes.ts` — remove raw `db.` call (line 28)
- `src/server/modules/magic/service.ts` — add `assertParentExists`
- `src/server/modules/magic/routes.ts` — remove raw `db.` call (line 81)
- `src/server/modules/sync/service.ts` — remove `getSyncConnectionColumns` schema branching, extract sub-functions from `syncGoogleConnectionNow`

---

## Task 1: Extract useSettingsController

**Context:** `SettingsView.tsx` is 834 lines with 44 `useState` calls and all async logic inlined — no controller hook like every other view in the app. This makes it untestable and hard to develop.

**Files:**
- Create: `src/hooks/useSettingsController.ts`
- Modify: `src/components/parent/SettingsView.tsx`

- [ ] **Step 1: Create the hook file with the state types**

Create `src/hooks/useSettingsController.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { settingsClientService } from '../services/settings';
import { syncClientService, SyncNowResult } from '../services/sync';
import { userService } from '../services/users';
import { inviteService } from '../services/invites';
import { photosClientService } from '../services/photos';
import { FamilySettings, SyncCalendar } from '../types';

const LOCATION_OPTIONS = [
  { id: 'new_york', label: 'New York, NY', lat: 40.7128, lon: -74.0060, timezone: 'America/New_York' },
  { id: 'chicago', label: 'Chicago, IL', lat: 41.8781, lon: -87.6298, timezone: 'America/Chicago' },
  { id: 'denver', label: 'Denver, CO', lat: 39.7392, lon: -104.9903, timezone: 'America/Denver' },
  { id: 'los_angeles', label: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437, timezone: 'America/Los_Angeles' },
  { id: 'seattle', label: 'Seattle, WA', lat: 47.6062, lon: -122.3321, timezone: 'America/Los_Angeles' },
  { id: 'miami', label: 'Miami, FL', lat: 25.7617, lon: -80.1918, timezone: 'America/New_York' },
  { id: 'london', label: 'London, UK', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { id: 'paris', label: 'Paris, France', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
  { id: 'tokyo', label: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
] as const;

export const DEFAULT_LOCATION = LOCATION_OPTIONS[1];
export { LOCATION_OPTIONS };

export const TIMEZONES: string[] = typeof Intl !== 'undefined' && (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
  ? (Intl as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  : ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];

export function findPresetLocation(lat?: number, lon?: number) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return LOCATION_OPTIONS.find(o => Math.abs(o.lat - lat) < 0.01 && Math.abs(o.lon - lon) < 0.01) ?? null;
}

interface UseSettingsControllerOptions {
  parentId: string;
  currentThemeId?: string;
  onSaved?: (settings: FamilySettings) => void;
  onClose: () => void;
  onThemeChange?: (themeId: string) => void;
  onPreviewScreensaver?: () => void;
}

export function useSettingsController({
  parentId,
  currentThemeId,
  onSaved,
  onClose,
  onThemeChange,
  onPreviewScreensaver,
}: UseSettingsControllerOptions) {
  // --- location / time ---
  const [locationLat, setLocationLat] = useState(DEFAULT_LOCATION.lat);
  const [locationLon, setLocationLon] = useState(DEFAULT_LOCATION.lon);
  const [locationPreset, setLocationPreset] = useState<string>(DEFAULT_LOCATION.id);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [sleepStart, setSleepStart] = useState('21:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');
  const [detectingLocation, setDetectingLocation] = useState(false);

  // --- theme ---
  const [activeThemeId, setActiveThemeId] = useState(currentThemeId ?? 'space_commander');

  // --- PIN / security ---
  const [pin, setPin] = useState('');
  const [hasPIN, setHasPIN] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);

  // --- saving ---
  const [saving, setSaving] = useState(false);

  // --- calendar sync ---
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncResult, setSyncResult] = useState<SyncNowResult | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [calendars, setCalendars] = useState<SyncCalendar[]>([]);
  const [calendarVisibility, setCalendarVisibility] = useState<Record<string, boolean>>({});

  // --- co-parents ---
  const [coParents, setCoParents] = useState<{ uid: string; name: string; email: string }[]>([]);
  const [coParentInvite, setCoParentInvite] = useState<{ id: string } | null>(null);

  // --- display / screensaver ---
  const [displayRotationEnabled, setDisplayRotationEnabled] = useState(false);
  const [displayRotationInterval, setDisplayRotationInterval] = useState(30);
  const [screensaverShuffle, setScreensaverShuffle] = useState(false);
  const [screensaverDurationSec, setScreensaverDurationSec] = useState(10);
  const [screensaverCaptions, setScreensaverCaptions] = useState(true);

  // --- photos ---
  const [photoCleanupEnabled, setPhotoCleanupEnabled] = useState(true);
  const [photoCleanupIntervalHours, setPhotoCleanupIntervalHours] = useState(24);
  const [googlePhotosEnabled, setGooglePhotosEnabled] = useState(false);
  const [googleAlbumsError, setGoogleAlbumsError] = useState('');
  const [pickerSessionId, setPickerSessionId] = useState('');
  const [pickerUri, setPickerUri] = useState('');
  const [creatingPickerSession, setCreatingPickerSession] = useState(false);
  const [importingPickerSelection, setImportingPickerSelection] = useState(false);
  const [pickerPolling, setPickerPolling] = useState(false);
  const [photoRefreshToken, setPhotoRefreshToken] = useState(0);
  const [previewMessage, setPreviewMessage] = useState('');

  // --- shopping/location tags ---
  const [customStoreNames, setCustomStoreNames] = useState<string[]>([]);
  const [customLocationNames, setCustomLocationNames] = useState<string[]>([]);

  const loadBootstrapData = useCallback(async () => {
    const [cp, cpi, bootstrap] = await Promise.all([
      userService.getCoParents(parentId).catch(() => []),
      inviteService.getActiveCoParentInvite(parentId).catch(() => null),
      settingsClientService.getBootstrap(parentId).catch(() => null),
    ]);
    setCoParents(cp ?? []);
    setCoParentInvite(cpi ?? null);
    if (!bootstrap) return;

    const s = bootstrap.settings;
    const matched = findPresetLocation(s.locationLat, s.locationLon);
    if (matched) {
      setLocationPreset(matched.id);
      setLocationLat(matched.lat);
      setLocationLon(matched.lon);
    } else {
      setLocationPreset('custom');
      setLocationLat(typeof s.locationLat === 'number' ? s.locationLat : DEFAULT_LOCATION.lat);
      setLocationLon(typeof s.locationLon === 'number' ? s.locationLon : DEFAULT_LOCATION.lon);
    }
    setTimezone(s.timezone ?? 'America/Chicago');
    setTemperatureUnit((s.temperatureUnit as 'celsius' | 'fahrenheit') ?? 'celsius');
    setTimeFormat((s.timeFormat as '12h' | '24h') ?? '12h');
    setSleepStart(s.sleepStart ?? '21:00');
    setSleepEnd(s.sleepEnd ?? '07:00');
    setHasPIN(Boolean(s.hasPIN));
    setDisplayRotationEnabled(Boolean(s.displayRotationEnabled));
    setDisplayRotationInterval(s.displayRotationInterval ?? 30);
    setScreensaverShuffle(Boolean(s.screensaverShuffle));
    setScreensaverDurationSec(s.screensaverDurationSec ?? 10);
    setScreensaverCaptions(s.screensaverCaptions !== false);
    setPhotoCleanupEnabled(s.photoCleanupEnabled ?? true);
    setPhotoCleanupIntervalHours(s.photoCleanupIntervalHours ?? 24);
    setGooglePhotosEnabled(Boolean(s.googlePhotosEnabled));
    setCustomStoreNames(s.customStoreNames ?? []);
    setCustomLocationNames(s.customLocationNames ?? []);
    setCalendars((bootstrap.calendars ?? []) as SyncCalendar[]);

    const visMap: Record<string, boolean> = {};
    (bootstrap.calendarVisibility ?? []).forEach((v: { calendarId: string; isVisible: number }) => {
      visMap[v.calendarId] = Number(v.isVisible) === 1;
    });
    setCalendarVisibility(visMap);

    const conns = bootstrap.connections ?? [];
    setConnectionId(conns[0]?.id ?? null);
    const withSync = conns.filter((c: { lastSyncAt?: number }) => c.lastSyncAt);
    if (withSync.length > 0) {
      const latest = withSync.reduce((a: { lastSyncAt: number }, b: { lastSyncAt: number }) =>
        a.lastSyncAt > b.lastSyncAt ? a : b
      );
      setLastSyncAt(latest.lastSyncAt ?? null);
      setLastSyncStatus((latest as { lastSyncStatus?: string }).lastSyncStatus ?? null);
    } else {
      setLastSyncAt(null);
      setLastSyncStatus(null);
    }
  }, [parentId]);

  useEffect(() => { void loadBootstrapData(); }, [loadBootstrapData]);

  useEffect(() => {
    const onFocus = () => { void loadBootstrapData(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void loadBootstrapData(); };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'kidtasker:google-sync-connected') return;
      if (event.data?.parentId && event.data.parentId !== parentId) return;
      setSyncStatus('Google connected. Refreshing settings...');
      void loadBootstrapData().then(() => setSyncStatus('Google connected.'));
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('message', onMessage);
    };
  }, [loadBootstrapData, parentId]);

  useEffect(() => {
    if (!googlePhotosEnabled) setGoogleAlbumsError('');
  }, [parentId, googlePhotosEnabled]);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {}
  }, []);

  // Google Photos picker polling
  useEffect(() => {
    if (!pickerPolling || !pickerSessionId || !googlePhotosEnabled) return;
    let attempts = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      if (attempts > 24) {
        setPickerPolling(false);
        setGoogleAlbumsError('Picker session timed out. Re-open picker and try again.');
        return;
      }
      try {
        let pageToken: string | undefined;
        const items: Array<{ id: string; baseUrl: string; filename?: string }> = [];
        for (let i = 0; i < 5; i++) {
          const res = await photosClientService.getGooglePickerMediaItems(parentId, pickerSessionId, 50, pageToken);
          items.push(...(res.items ?? []));
          if (!res.nextPageToken) break;
          pageToken = res.nextPageToken ?? undefined;
        }
        if (items.length === 0) return;
        const result = await photosClientService.importGooglePickerItems(parentId, pickerSessionId, items);
        if (result.imported === 0 && !result.skipped) return;
        setGoogleAlbumsError(`Auto-import complete: ${result.imported} photo${result.imported === 1 ? '' : 's'}${result.skipped ? `, ${result.skipped} already imported` : ''}.`);
        setPhotoRefreshToken(n => n + 1);
        setPickerPolling(false);
      } catch {
        // transient picker propagation — keep polling
      }
    };
    const interval = setInterval(() => { void tick(); }, 5000);
    void tick();
    return () => { cancelled = true; clearInterval(interval); };
  }, [pickerPolling, pickerSessionId, googlePhotosEnabled, parentId]);

  const handleThemeChange = async (themeId: string) => {
    const prev = activeThemeId;
    setActiveThemeId(themeId);
    try {
      await userService.updateUserTheme(parentId, themeId);
      onThemeChange?.(themeId);
    } catch {
      setActiveThemeId(prev);
    }
  };

  const handleLocationChange = (value: string) => {
    setLocationPreset(value);
    const selected = LOCATION_OPTIONS.find(o => o.id === value);
    if (!selected) return;
    setLocationLat(selected.lat);
    setLocationLon(selected.lon);
    setTimezone(selected.timezone);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        const matched = findPresetLocation(lat, lon);
        setLocationLat(lat);
        setLocationLon(lon);
        setLocationPreset(matched ? matched.id : 'custom');
        setDetectingLocation(false);
      },
      () => setDetectingLocation(false)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Partial<FamilySettings> = {
        locationLat, locationLon, timezone, temperatureUnit, timeFormat,
        sleepStart, sleepEnd,
        ...(pin.trim() ? { pin } : {}),
        displayRotationEnabled, displayRotationInterval,
        screensaverShuffle, screensaverDurationSec, screensaverCaptions,
        customStoreNames, customLocationNames,
        photoCleanupEnabled,
        photoCleanupIntervalHours: Math.max(1, photoCleanupIntervalHours),
        googlePhotosEnabled,
        googlePhotosAlbumId: null,
      };
      await settingsClientService.saveSettings(parentId, data);
      if (pin.trim()) { setHasPIN(true); setPin(''); setShowPinInput(false); }
      onSaved?.({ parentId, ...data } as FamilySettings);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    if (!connectionId) { setSyncStatus('No Google connection found to sync.'); return; }
    setSyncingNow(true); setSyncStatus(''); setSyncResult(null);
    try {
      const res = await syncClientService.syncNow(connectionId);
      setSyncResult(res);
      setLastSyncAt(res.finishedAt);
      setLastSyncStatus(res.failureCount === 0 ? 'ok' : res.successCount > 0 ? 'partial' : 'error');
      setSyncStatus(res.failureCount === 0
        ? `Synced: ${res.imported} imported, ${res.updated} updated.`
        : `Partial sync: ${res.successCount} ok, ${res.failureCount} failed.`);
    } catch {
      setSyncStatus('Sync failed. Check your Google connection.');
    } finally {
      setSyncingNow(false);
    }
  };

  const handleToggleCalendarVisibility = async (calendarId: string) => {
    const current = calendarVisibility[calendarId] ?? true;
    setCalendarVisibility(prev => ({ ...prev, [calendarId]: !current }));
    try {
      await settingsClientService.setCalendarVisibility(calendarId, !current);
    } catch {
      setCalendarVisibility(prev => ({ ...prev, [calendarId]: current }));
    }
  };

  const handleStartGooglePicker = async () => {
    setCreatingPickerSession(true); setGoogleAlbumsError('');
    try {
      const session = await photosClientService.createGooglePickerSession(parentId);
      setPickerSessionId(session.sessionId);
      setPickerUri(session.pickerUri);
      setPickerPolling(true);
      window.open(session.pickerUri, '_blank', 'noopener,noreferrer');
    } catch (e: unknown) {
      setGoogleAlbumsError(e instanceof Error ? e.message : 'Failed to start Google Photos Picker.');
    } finally {
      setCreatingPickerSession(false);
    }
  };

  const handleImportPickerSelection = async () => {
    if (!pickerSessionId) { setGoogleAlbumsError('Start Google Photos Picker first, select photos, then import.'); return; }
    setImportingPickerSelection(true); setGoogleAlbumsError('');
    try {
      let pageToken: string | undefined;
      const items: Array<{ id: string; baseUrl: string; filename?: string }> = [];
      for (let i = 0; i < 10; i++) {
        const res = await photosClientService.getGooglePickerMediaItems(parentId, pickerSessionId, 50, pageToken);
        items.push(...(res.items ?? []));
        if (!res.nextPageToken) break;
        pageToken = res.nextPageToken ?? undefined;
      }
      if (items.length === 0) {
        setGoogleAlbumsError('No selected photos found yet. Select photos in the picker, then import again.');
        return;
      }
      const result = await photosClientService.importGooglePickerItems(parentId, pickerSessionId, items);
      if (result.imported === 0 && !result.skipped) {
        setGoogleAlbumsError('No finalized selections found yet. Complete your selection in Google Photos, then import again.');
      } else {
        setGoogleAlbumsError(`Imported ${result.imported} photo${result.imported === 1 ? '' : 's'}${result.skipped ? `, ${result.skipped} already imported` : ''}${result.unresolved ? `, ${result.unresolved} unresolved` : ''}.`);
        setPhotoRefreshToken(n => n + 1);
      }
    } catch (e: unknown) {
      setGoogleAlbumsError(e instanceof Error ? e.message : 'Failed to import selected Google Photos.');
    } finally {
      setImportingPickerSelection(false);
    }
  };

  const handlePreviewScreensaver = async () => {
    try {
      const photos = await photosClientService.getPhotos(parentId);
      if (!photos?.length) { setPreviewMessage('No imported photos yet. Import or upload photos first.'); return; }
      setPreviewMessage('');
      onPreviewScreensaver?.();
    } catch {
      setPreviewMessage('Could not load photos for preview. Try again.');
    }
  };

  return {
    // location/time
    locationLat, locationLon, locationPreset, timezone, setTimezone,
    temperatureUnit, setTemperatureUnit, timeFormat, setTimeFormat,
    sleepStart, setSleepStart, sleepEnd, setSleepEnd,
    detectingLocation, detectLocation, handleLocationChange,
    // theme
    activeThemeId, handleThemeChange,
    // security
    pin, setPin, hasPIN, showPinInput, setShowPinInput,
    // co-parents
    coParents, setCoParents, coParentInvite, setCoParentInvite,
    // calendar sync
    connectionId, lastSyncAt, lastSyncStatus, calendars,
    calendarVisibility, syncingNow, syncStatus, syncResult, showDiagnostics, setShowDiagnostics,
    handleSyncNow, handleToggleCalendarVisibility,
    // display / screensaver
    displayRotationEnabled, setDisplayRotationEnabled,
    displayRotationInterval, setDisplayRotationInterval,
    screensaverShuffle, setScreensaverShuffle,
    screensaverDurationSec, setScreensaverDurationSec,
    screensaverCaptions, setScreensaverCaptions,
    // photos
    photoCleanupEnabled, setPhotoCleanupEnabled,
    photoCleanupIntervalHours, setPhotoCleanupIntervalHours,
    googlePhotosEnabled, setGooglePhotosEnabled,
    googleAlbumsError, pickerSessionId, pickerUri, pickerPolling,
    creatingPickerSession, importingPickerSelection,
    photoRefreshToken, previewMessage,
    handleStartGooglePicker, handleImportPickerSelection, handlePreviewScreensaver,
    // shopping/location tags
    customStoreNames, setCustomStoreNames,
    customLocationNames, setCustomLocationNames,
    // save
    saving, handleSave,
  };
}
```

- [ ] **Step 2: Update SettingsView to use the hook**

Replace the entire body of `SettingsView` to call `useSettingsController`. All the state vars and handler functions come from the hook. The component only renders JSX — no `useState` or `async` logic inline.

Key mechanical change: the component goes from ~780 lines of mixed state+JSX to ~400 lines of pure JSX. The logic in `handlePreviewScreensaver` that calls `onPreviewScreensaver?.()` needs to be kept — pass `onPreviewScreensaver` into the hook or keep that one handler in the component since it calls a prop directly.

Simplest approach: pass `onPreviewScreensaver` into the hook so it can call it internally. Update `UseSettingsControllerOptions` to include `onPreviewScreensaver?: () => void`.

- [ ] **Step 3: Move constants to the hook file and import in SettingsView**

`LOCATION_OPTIONS`, `DEFAULT_LOCATION`, `TIMEZONES`, `findPresetLocation` are now in the hook. Import them in `SettingsView` for the JSX.

```typescript
import { useSettingsController, LOCATION_OPTIONS, TIMEZONES, DEFAULT_LOCATION } from '../../hooks/useSettingsController';
```

- [ ] **Step 4: Run dev server and verify SettingsView opens + saves correctly**

```bash
pnpm dev
```

Open Settings, change a setting, save, reopen — values should persist. Test: toggle screensaver, sync calendar, detect location.

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run
```

Expected: all passing (no SettingsView unit tests exist yet, but existing tests should not regress).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSettingsController.ts src/components/parent/SettingsView.tsx
git commit -m "refactor: extract useSettingsController hook from SettingsView"
```

---

## Task 2: Move raw db calls from tasks/routes.ts to tasks/service.ts

**Context:** `tasks/routes.ts` contains 3 direct `db.prepare(...)` calls at lines 323, 353, 360, 362 for leaderboard members and power mission lookup. These belong in the service layer.

**Files:**
- Modify: `src/server/modules/tasks/service.ts`
- Modify: `src/server/modules/tasks/routes.ts`

- [ ] **Step 1: Add service functions to tasks/service.ts**

Add to `taskServiceServer` object in `src/server/modules/tasks/service.ts`:

```typescript
getFamilyMembers: (parentId: string): Array<{ uid: string; name: string; role: string }> => {
  return db.prepare(
    "SELECT uid, name, role FROM users WHERE (uid = ? OR parentId = ?) AND role IN ('parent','kid','coparent')"
  ).all(parentId, parentId) as Array<{ uid: string; name: string; role: string }>;
},

getPowerMission: (parentId: string): import('../../../types.js').PowerMission | null => {
  const parent = db.prepare('SELECT powerMissionId, powerMissionDate FROM users WHERE uid = ?')
    .get(parentId) as { powerMissionId: string | null; powerMissionDate: string | null } | undefined;
  const today = new Date().toISOString().slice(0, 10);
  if (!parent?.powerMissionId || parent.powerMissionDate !== today) return null;
  // Note: tasks table has no xpReward column — use difficulty and derive XP server-side
  const taskRow = db.prepare('SELECT title, difficulty, assignedKidId FROM tasks WHERE id = ?')
    .get(parent.powerMissionId) as { title: string; difficulty: string | null; assignedKidId: string } | undefined;
  if (!taskRow) return null;
  const kid = db.prepare('SELECT name FROM users WHERE uid = ?')
    .get(taskRow.assignedKidId ?? '') as { name: string } | undefined;
  return {
    taskId: parent.powerMissionId,
    title: taskRow.title,
    xpReward: xpForDifficulty(taskRow.difficulty),
    assignedKidId: taskRow.assignedKidId ?? '',
    assignedKidName: kid?.name ?? '',
  };
},
```

- [ ] **Step 2: Update tasks/routes.ts to call service functions**

In the leaderboard route (around line 323), replace:
```typescript
const members = db.prepare("SELECT uid, name, role FROM users WHERE ...").all(...) as ...
```
With:
```typescript
const members = taskServiceServer.getFamilyMembers(parentId);
```

In the power-mission route (around lines 353-362), replace the entire block:
```typescript
const parent = db.prepare(...).get(parentId) as ...
// ... all the db calls ...
const payload: PowerMission = { ... };
return res.json(payload);
```
With:
```typescript
const payload = taskServiceServer.getPowerMission(parentId);
return res.json(payload);
```

Remove `import { db } from '../../db.js';` from routes.ts if no other db calls remain.

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run src/server/modules/tasks/
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src/server/modules/tasks/service.ts src/server/modules/tasks/routes.ts
git commit -m "refactor: move raw db calls from tasks/routes to tasks/service"
```

---

## Task 3: Move raw db calls from events/routes.ts to events/service.ts

**Context:** `events/routes.ts` line 123 does a raw `db.prepare` to validate family membership. Should be a service function.

**Files:**
- Modify: `src/server/modules/events/service.ts`
- Modify: `src/server/modules/events/routes.ts`

- [ ] **Step 1: Read the current events service to find the right place to add**

```bash
grep -n "export" src/server/modules/events/service.ts | head -20
```

- [ ] **Step 2: Add assertFamilyMember to events/service.ts**

```typescript
export function assertFamilyMember(targetUserId: string, parentId: string): boolean {
  const row = db.prepare(
    'SELECT uid FROM users WHERE uid = ? AND (uid = ? OR parentId = ?)'
  ).get(targetUserId, parentId, parentId) as { uid: string } | undefined;
  return Boolean(row);
}
```

- [ ] **Step 3: Update events/routes.ts**

Import the function and replace the raw db call:

```typescript
import { assertFamilyMember } from './service.js';
```

Replace:
```typescript
const familyUser = db.prepare('SELECT uid FROM users WHERE uid = ? AND (uid = ? OR parentId = ?)').get(...) as { uid: string } | undefined;
if (!familyUser) return res.status(403).json({ error: 'Not authorized' });
```
With:
```typescript
if (!assertFamilyMember(targetUserId, parentId)) return res.status(403).json({ error: 'Not authorized' });
```

Remove `import { db } from '../../db.js';` if no other db calls remain.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/server/modules/events/
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/events/service.ts src/server/modules/events/routes.ts
git commit -m "refactor: move raw db calls from events/routes to events/service"
```

---

## Task 4: Move raw db calls from photos/routes.ts to photos/service.ts

**Context:** `photos/routes.ts` has raw `db.prepare` calls at lines 34, 152, 163, 301 for photo ownership checks. These should be centralized in the service.

**Files:**
- Modify: `src/server/modules/photos/service.ts` (or create if doesn't exist)
- Modify: `src/server/modules/photos/routes.ts`

- [ ] **Step 1: Check if photos/service.ts exists and what's in it**

```bash
cat src/server/modules/photos/service.ts | head -30
```

- [ ] **Step 2: Add 3 photo service functions to photos service**

The routes have 3 distinct db query patterns — all need a service function:

```typescript
// Pattern 1: ownership by ID (lines 152, 163)
export function getPhotoParentId(photoId: string): string | null {
  const row = db.prepare('SELECT parentId FROM family_photos WHERE id = ?')
    .get(String(photoId)) as { parentId: string } | undefined;
  return row?.parentId ?? null;
}

// Pattern 2: ownership by URL — file-serve route (line 34)
// Two URL formats: new API URL and legacy /uploads/ URL
export function getPhotoParentIdByUrl(apiUrl: string, legacyUrl: string): string | null {
  const row = db.prepare('SELECT parentId FROM family_photos WHERE url = ? OR url = ?')
    .get(apiUrl, legacyUrl) as { parentId: string } | undefined;
  return row?.parentId ?? null;
}

// Pattern 3: bulk URL lookup for dedup check (line 301) — dynamic IN clause
export function getExistingPhotoUrls(parentId: string, urls: string[]): string[] {
  if (urls.length === 0) return [];
  const placeholders = urls.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT url FROM family_photos WHERE parentId = ? AND url IN (${placeholders})`
  ).all(parentId, ...urls) as Array<{ url: string }>;
  return rows.map(r => r.url);
}
```

- [ ] **Step 3: Update photos/routes.ts**

- Line 34 (file-serve route): Replace raw `db.prepare(...).get(apiUrl, legacyUrl)` with `getPhotoParentIdByUrl(apiUrl, legacyUrl)`.
- Lines 152, 163 (delete/update routes): Replace `db.prepare('SELECT parentId FROM family_photos WHERE id = ?').get(...)` with `getPhotoParentId(req.params.id)`.
- Line 301 (bulk check): Replace dynamic `db.prepare(...).all(parentId, ...uniqueUrls)` with `getExistingPhotoUrls(parentId, uniqueUrls)`.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/server/modules/photos/
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/photos/service.ts src/server/modules/photos/routes.ts
git commit -m "refactor: move raw db calls from photos/routes to photos/service"
```

---

## Task 5: Move raw db calls from notes/routes.ts and magic/routes.ts to services

**Context:** `notes/routes.ts` line 28 does a user name lookup. `magic/routes.ts` line 81 validates parent existence. Both belong in services.

**Files:**
- Modify: `src/server/modules/notes/service.ts`
- Modify: `src/server/modules/notes/routes.ts`
- Modify: `src/server/modules/magic/service.ts`
- Modify: `src/server/modules/magic/routes.ts`

- [ ] **Step 1: Add getUserName to notes/service.ts**

```typescript
export function getUserName(uid: string): string | null {
  const row = db.prepare('SELECT name FROM users WHERE uid = ?').get(uid) as { name: string } | undefined;
  return row?.name ?? null;
}
```

- [ ] **Step 2: Update notes/routes.ts**

```typescript
import { getUserName } from './service.js';
// Replace: const callerUser = db.prepare('SELECT name FROM users WHERE uid = ?').get(callerUid) as any;
const callerName = getUserName(callerUid);
```

Remove `import { db } from '../../db.js';` if no other raw db calls remain.

- [ ] **Step 3: Add assertParentExists to magic/service.ts**

```typescript
export function assertParentExists(parentId: string): boolean {
  const row = db.prepare("SELECT uid FROM users WHERE uid = ? AND role = 'parent'").get(parentId) as { uid: string } | undefined;
  return Boolean(row);
}
```

- [ ] **Step 4: Update magic/routes.ts**

```typescript
import { assertParentExists } from './service.js';
// Replace the db.prepare block with:
if (!assertParentExists(parentId)) return res.status(404).json({ error: 'Parent not found' });
```

Remove `import { db } from '../../db.js';` if no other raw db calls remain.

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/server/modules/notes/ src/server/modules/magic/
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/notes/service.ts src/server/modules/notes/routes.ts src/server/modules/magic/service.ts src/server/modules/magic/routes.ts
git commit -m "refactor: move raw db calls from notes and magic routes to services"
```

---

## Task 6: Kill runtime schema branching in sync/service.ts

**Context:** `getSyncConnectionColumns()` at line 30 does `PRAGMA table_info` at runtime to branch SQL queries based on whether `createdAt`, `lastSyncAt`, `lastSyncStatus` exist. These columns are guaranteed by migrations 011 and 022 — they always exist. The branching is dead code that makes queries harder to read.

**Files:**
- Modify: `src/server/modules/sync/service.ts`

- [ ] **Step 1: Verify all three columns exist in migration files**

```bash
grep -n "createdAt\|lastSyncAt\|lastSyncStatus" src/server/migrations/011_add_sync_schema.sql src/server/migrations/022_add_sync_status.sql
```

Expected output: all three columns appear in ALTER TABLE statements. Confirm before proceeding.

- [ ] **Step 2: Update ALL callers of getSyncConnectionColumns before deleting it**

`getSyncConnectionColumns` is called in 4 places. Fix all 4 before deleting the function or the build will break.

**persistSyncStatus (line 150):** The column guard is no longer needed. Simplify to:

```typescript
function persistSyncStatus(connectionId: string, status: 'ok' | 'partial' | 'error') {
  db.prepare('UPDATE sync_connections SET lastSyncAt = ?, lastSyncStatus = ? WHERE id = ?')
    .run(Date.now(), status, connectionId);
}
```

**getActiveGoogleConnection (line 320):** Replace with hardcoded ORDER BY:

```typescript
getActiveGoogleConnection: (parentId: string): SyncConnection | null => {
  const row = db.prepare(
    "SELECT * FROM sync_connections WHERE parentId = ? AND provider = 'google' ORDER BY COALESCE(createdAt, 0) DESC, rowid DESC LIMIT 1"
  ).get(parentId) as SyncConnection | null;
  return row ? decryptConnection(row) : null;
},
```

- [ ] **Step 3: Remove getSyncConnectionColumns, buildGoogleConnectionOrderBy, and SyncConnectionColumns type**

After updating all 4 callers above (plus getConnections and saveGoogleTokens in steps 4 and 5 below), delete:
```typescript
// DELETE these functions:
function getSyncConnectionColumns(): SyncConnectionColumns { ... }
function buildGoogleConnectionOrderBy(columns: SyncConnectionColumns): string { ... }
// DELETE this type:
type SyncConnectionColumns = { hasCreatedAt: boolean; hasLastSyncAt: boolean; hasLastSyncStatus: boolean; };
```

- [ ] **Step 4: Update getConnections to use hardcoded SELECT and ORDER BY**

In `syncService.getConnections`, replace all `columns.*` conditional column selects and the `buildGoogleConnectionOrderBy` call with hardcoded SQL:

```typescript
getConnections: (parentId: string) => {
  return db.prepare(`
    SELECT id, provider, createdAt, lastSyncAt, lastSyncStatus
    FROM sync_connections
    WHERE parentId = ? AND provider = 'google'
    ORDER BY COALESCE(createdAt, 0) DESC, rowid DESC
  `).all(parentId);
},
```

- [ ] **Step 5: Update saveGoogleTokens to remove column-branching**

In `saveGoogleTokens`, find any `if (columns.hasCreatedAt)` branch. Keep only the version that writes `createdAt`:

```typescript
db.prepare(`
  UPDATE sync_connections
  SET accessToken = ?, refreshToken = ?, createdAt = ?
  WHERE id = ?
`).run(encryptedAccessToken, nextRefreshToken, now, existing.id);
```

And in the INSERT branch, always include `createdAt`:
```typescript
db.prepare(`
  INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken, createdAt)
  VALUES (?, ?, 'google', ?, ?, ?)
`).run(connId, parentId, encryptedAccessToken, nextRefreshToken, now);
```

- [ ] **Step 6: Run sync service tests**

```bash
pnpm vitest run src/server/modules/sync/
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/server/modules/sync/service.ts
git commit -m "refactor: remove runtime schema branching in sync service"
```

---

## Task 7: Split syncGoogleConnectionNow into sub-functions

**Context:** `syncGoogleConnectionNow` is 161 lines doing: color map fetch, calendar list fetch+upsert, existing event load, per-calendar event reconcile, status persist. Each of these is a distinct operation that should be extractable and readable in isolation.

**Files:**
- Modify: `src/server/modules/sync/service.ts`

- [ ] **Step 1: Extract buildGoogleEventColorMap**

Before the `syncService` object, add:

```typescript
async function buildGoogleEventColorMap(
  calendar: ReturnType<typeof getCalendarClient>
): Promise<Record<string, string>> {
  const colorMapResponse = await calendar.colors.get();
  const apiEventColors = colorMapResponse.data.event ?? {};
  const merged: Record<string, string> = { ...GOOGLE_EVENT_COLOR_MAP };
  for (const [colorId, value] of Object.entries(apiEventColors)) {
    if (value?.background) merged[colorId] = value.background;
  }
  return merged;
}
```

- [ ] **Step 2: Extract fetchAndUpsertCalendars**

```typescript
async function fetchAndUpsertCalendars(
  calendar: ReturnType<typeof getCalendarClient>,
  conn: SyncConnection
): Promise<{ calendarIds: string[]; calendarColorById: Map<string, string> }> {
  const upsertStmt = db.prepare(`
    INSERT INTO sync_calendars (id, connectionId, parentId, calendarId, name, enabled, color, isSharedCalendar)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(connectionId, calendarId) DO UPDATE SET id = excluded.id, name = excluded.name, color = excluded.color, isSharedCalendar = excluded.isSharedCalendar
  `);
  const calList = await calendar.calendarList.list();
  const allCals = (calList.data.items ?? []).filter(c => c.id && c.accessRole !== 'freeBusyReader');
  const calendarColorById = new Map<string, string>();
  for (const cal of allCals) {
    if (cal.id) calendarColorById.set(cal.id, cal.backgroundColor ?? cal.foregroundColor ?? '#6366f1');
    const id = buildSyncCalendarId(conn.id, cal.id!);
    const color = cal.backgroundColor ?? cal.foregroundColor ?? '#6366f1';
    const isShared = cal.accessRole !== 'owner' ? 1 : 0;
    upsertStmt.run(id, conn.id, conn.parentId, cal.id!, cal.summary ?? cal.id!, color, isShared);
  }
  const calendarRows = db.prepare('SELECT calendarId, enabled FROM sync_calendars WHERE connectionId = ?')
    .all(conn.id) as { calendarId: string; enabled: number }[];
  const enabledRows = calendarRows.filter(r => r.enabled === 1);
  const enabledIds = enabledRows.map(r => r.calendarId);
  const calendarIds = calendarRows.length === 0 ? allCals.map(c => c.id!) : enabledIds;
  if (calendarRows.length === 0 && calendarIds.length === 0) calendarIds.push('primary');
  return { calendarIds, calendarColorById };
}
```

- [ ] **Step 3: Extract loadExistingGoogleEvents**

```typescript
type ExistingEventRow = { id: string; title: string; description: string | null; startTime: number; endTime: number; color: string | null; sourceCalendarId: string | null };

function loadExistingGoogleEvents(parentId: string): Map<string, ExistingEventRow> {
  const rows = db.prepare(
    "SELECT id, externalId, title, description, startTime, endTime, color, sourceCalendarId FROM events WHERE parentId = ? AND source = 'google' AND externalId IS NOT NULL"
  ).all(parentId) as Array<ExistingEventRow & { externalId: string }>;
  return new Map(rows.map(row => [row.externalId, { id: row.id, title: row.title, description: row.description, startTime: row.startTime, endTime: row.endTime, color: row.color, sourceCalendarId: row.sourceCalendarId }]));
}
```

- [ ] **Step 4: Extract reconcileCalendarEvents**

```typescript
type ReconcileStmts = { insert: ReturnType<typeof db.prepare>; update: ReturnType<typeof db.prepare> };

function reconcileCalendarEvents(
  googleEvents: any[],
  existingMap: Map<string, ExistingEventRow>,
  stmts: ReconcileStmts,
  googleEventColors: Record<string, string>,
  calendarColorById: Map<string, string>,
  calId: string,
  parentId: string
): { imported: number; updated: number } {
  let imported = 0;
  let updated = 0;
  for (const ev of googleEvents) {
    if (!ev.id || !ev.summary || !ev.start?.dateTime || !ev.end?.dateTime) continue;
    const externalId = ev.id;
    const eId = buildLocalGoogleEventId(externalId);
    const derivedColor = resolveEventColor(ev.colorId, googleEventColors, calendarColorById.get(calId));
    const startTime = new Date(ev.start.dateTime).getTime();
    const endTime = new Date(ev.end.dateTime).getTime();
    const description = ev.description ?? '';
    const existing = existingMap.get(externalId) ?? existingMap.get(eId);
    if (!existing) {
      stmts.insert.run(eId, parentId, ev.summary, description, startTime, endTime, null, derivedColor, externalId, 'google', calId);
      existingMap.set(externalId, { id: eId, title: ev.summary, description, startTime, endTime, color: derivedColor, sourceCalendarId: calId });
      imported += 1;
    } else {
      const hasChanges =
        existing.title !== ev.summary ||
        (existing.description ?? '') !== description ||
        existing.startTime !== startTime ||
        existing.endTime !== endTime ||
        (existing.color ?? '') !== (derivedColor ?? '') ||
        (existing.sourceCalendarId ?? '') !== calId ||
        existingMap.get(eId)?.id === existing.id;
      if (hasChanges) {
        stmts.update.run(ev.summary, description, startTime, endTime, derivedColor, calId, externalId, existing.id);
        existingMap.set(externalId, { id: existing.id, title: ev.summary, description, startTime, endTime, color: derivedColor, sourceCalendarId: calId });
        updated += 1;
      }
    }
  }
  return { imported, updated };
}
```

- [ ] **Step 5: Rewrite syncGoogleConnectionNow to call sub-functions**

```typescript
syncGoogleConnectionNow: async (connection: SyncConnection): Promise<SyncNowResult> => {
  const startedAt = Date.now();
  const errors: SyncCalendarError[] = [];
  let imported = 0;
  let updated = 0;
  let successCount = 0;
  let failureCount = 0;

  try {
    await withTokenRefresh(connection, async (conn) => {
      const calendar = getCalendarClient(conn);
      const [googleEventColors, { calendarIds, calendarColorById }] = await Promise.all([
        buildGoogleEventColorMap(calendar),
        fetchAndUpsertCalendars(calendar, conn),
      ]);
      const existingMap = loadExistingGoogleEvents(conn.parentId);
      const stmts: ReconcileStmts = {
        insert: db.prepare('INSERT INTO events (id, parentId, title, description, startTime, endTime, assignedToId, color, externalId, source, sourceCalendarId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
        update: db.prepare('UPDATE events SET title = ?, description = ?, startTime = ?, endTime = ?, color = ?, sourceCalendarId = ?, externalId = ? WHERE id = ?'),
      };

      for (const calId of calendarIds) {
        try {
          const res = await calendar.events.list({
            calendarId: calId, timeMin: new Date().toISOString(),
            maxResults: 50, singleEvents: true, orderBy: 'startTime',
          });
          const counts = reconcileCalendarEvents(
            res.data.items ?? [], existingMap, stmts, googleEventColors, calendarColorById, calId, conn.parentId
          );
          imported += counts.imported;
          updated += counts.updated;
          successCount += 1;
        } catch (calErr: unknown) {
          failureCount += 1;
          const msg = calErr instanceof Error ? calErr.message : String(calErr);
          errors.push({ calendarId: calId, message: msg });
          logger.error({ connectionId: conn.id, calendarId: calId, error: msg }, 'sync_calendar_failed');
        }
      }
    });
  } catch (e: unknown) {
    failureCount += 1;
    const msg = e instanceof Error ? e.message : String(e);
    errors.push({ calendarId: 'connection', message: msg });
    logger.error({ connectionId: connection.id, error: msg }, 'sync_connection_failed');
  }

  const finishedAt = Date.now();
  const status = failureCount === 0 ? 'ok' : successCount > 0 ? 'partial' : 'error';
  persistSyncStatus(connection.id, status);
  return { successCount, failureCount, errors, startedAt, finishedAt, imported, updated };
},
```

- [ ] **Step 6: Run all sync tests**

```bash
pnpm vitest run src/server/modules/sync/
```

Expected: all passing.

- [ ] **Step 7: Run full test suite**

```bash
pnpm vitest run
```

Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add src/server/modules/sync/service.ts
git commit -m "refactor: split syncGoogleConnectionNow into focused sub-functions"
```

---

## Task 8: Cleanup console.log and stray any catches

**Context:** 4 stray `console.*` calls in non-test source code should use the project logger. `catch (error: any)` is the dominant `any` pattern — replace with `catch (error: unknown)` and use `error instanceof Error ? error.message : String(error)` or a shared helper.

**Files:**
- Create: `src/server/lib/toErrorMessage.ts`
- Modify: whichever 4 files have stray `console.*`

- [ ] **Step 1: Find the 4 stray console calls**

```bash
grep -rn "console\." src --include=*.ts --include=*.tsx | grep -v test | grep -v clientLogger | grep -v setupTests
```

- [ ] **Step 2: Replace each with the appropriate logger**

For frontend files, use `clientLogger.error(...)`. For server files, use `logger.error(...)`.

- [ ] **Step 3: Create toErrorMessage helper**

Create `src/server/lib/toErrorMessage.ts`:

```typescript
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 4: Find highest-value any catch blocks**

```bash
grep -rn "catch (error: any)" src/server --include=*.ts | head -20
```

Replace the 10 highest-concentration files (mostly routes) with `catch (error: unknown)` + `toErrorMessage(error)`.

- [ ] **Step 5: Run full test suite**

```bash
pnpm vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/server/lib/toErrorMessage.ts src/
git commit -m "chore: replace console.log with logger, add toErrorMessage helper, tighten catch types"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests passing.

- [ ] **TypeScript check**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Start dev server and smoke-test**

```bash
pnpm dev
```

- Open Settings → change timezone → save → reopen — value persists
- Open Settings → sync now — sync completes
- Open Settings → toggle a calendar — visibility toggles
- Check leaderboard route works
- Check power mission route returns null or a mission

---

## Summary of Improvements

| Item | Before | After |
|------|--------|-------|
| SettingsView.tsx | 834 lines, 44 useState, untestable | ~400 lines pure JSX, logic in tested hook |
| Route files with raw db | 5 route files with db.prepare | 0 — all db calls in service layer |
| Runtime schema branching | PRAGMA table_info on every connection load | Deleted — migrations are authoritative |
| syncGoogleConnectionNow | 161-line function | 4 named sub-functions, coordinator ~40 lines |
| console.log in src | 4 stray calls | 0 |
| catch (error: any) | ~50 instances | Typed with toErrorMessage helper |
