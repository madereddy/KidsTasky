import { useState, useEffect, useCallback } from 'react';
import { settingsClientService } from '../services/settings';
import { syncClientService, SyncNowResult } from '../services/sync';
import { userService } from '../services/users';
import { inviteService } from '../services/invites';
import { photosClientService } from '../services/photos';
import { FamilySettings, SyncCalendar } from '../types';

export const TIMEZONES: string[] = typeof Intl !== 'undefined' && (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
  ? (Intl as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  : ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];

export const LOCATION_OPTIONS = [
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

export function useSettingsController({ parentId, currentThemeId, onSaved, onClose, onThemeChange, onPreviewScreensaver }: UseSettingsControllerOptions) {
  const [activeThemeId, setActiveThemeId] = useState(currentThemeId || 'space_commander');
  const [locationLat, setLocationLat] = useState<number>(DEFAULT_LOCATION.lat);
  const [locationLon, setLocationLon] = useState<number>(DEFAULT_LOCATION.lon);
  const [locationPreset, setLocationPreset] = useState<string>(DEFAULT_LOCATION.id);
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
    } catch {
      return 'America/Chicago';
    }
  });
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [sleepStart, setSleepStart] = useState('21:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');
  const [pin, setPin] = useState('');
  const [hasPIN, setHasPIN] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncResult, setSyncResult] = useState<SyncNowResult | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [calendars, setCalendars] = useState<SyncCalendar[]>([]);
  const [calendarVisibility, setCalendarVisibility] = useState<Record<string, boolean>>({});
  const [coParents, setCoParents] = useState<{uid: string; name: string; email: string}[]>([]);
  const [coParentInvite, setCoParentInvite] = useState<{id: string} | null>(null);
  const [displayRotationEnabled, setDisplayRotationEnabled] = useState(false);
  const [displayRotationInterval, setDisplayRotationInterval] = useState(30);
  const [screensaverShuffle, setScreensaverShuffle] = useState(false);
  const [screensaverDurationSec, setScreensaverDurationSec] = useState(10);
  const [screensaverCaptions, setScreensaverCaptions] = useState(true);
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
  const [customStoreNames, setCustomStoreNames] = useState<string[]>([]);
  const [customLocationNames, setCustomLocationNames] = useState<string[]>([]);

  const loadBootstrapData = useCallback(async () => {
    const [cp, cpi, bootstrap] = await Promise.all([
      userService.getCoParents(parentId).catch(() => []),
      inviteService.getActiveCoParentInvite(parentId).catch(() => null),
      settingsClientService.getBootstrap(parentId).catch(() => null),
    ]);

    setCoParents(cp || []);
    setCoParentInvite(cpi || null);
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
    setTimezone(s.timezone || 'America/Chicago');
    setTemperatureUnit((s.temperatureUnit as 'celsius' | 'fahrenheit') || 'celsius');
    setTimeFormat((s.timeFormat as '12h' | '24h') || '12h');
    setSleepStart(s.sleepStart || '21:00');
    setSleepEnd(s.sleepEnd || '07:00');
    setHasPIN(!!s.hasPIN);
    setDisplayRotationEnabled(Boolean(s.displayRotationEnabled));
    setDisplayRotationInterval(s.displayRotationInterval ?? 30);
    setScreensaverShuffle(Boolean(s.screensaverShuffle));
    setScreensaverDurationSec(s.screensaverDurationSec ?? 10);
    setScreensaverCaptions(s.screensaverCaptions !== false);
    setPhotoCleanupEnabled(s.photoCleanupEnabled ?? true);
    setPhotoCleanupIntervalHours(s.photoCleanupIntervalHours ?? 24);
    setGooglePhotosEnabled(Boolean(s.googlePhotosEnabled));
    setCustomStoreNames(s.customStoreNames || []);
    setCustomLocationNames(s.customLocationNames || []);

    setCalendars((bootstrap.calendars || []) as SyncCalendar[]);
    const visMap: Record<string, boolean> = {};
    (bootstrap.calendarVisibility || []).forEach((v: { calendarId: string; isVisible: number | boolean }) => {
      visMap[v.calendarId] = Number(v.isVisible) === 1;
    });
    setCalendarVisibility(visMap);

    type ConnRow = { id: string; lastSyncAt?: number; lastSyncStatus?: string };
    const conns: ConnRow[] = bootstrap.connections || [];
    setConnectionId(conns[0]?.id || null);
    const withSync = conns.filter((c) => c.lastSyncAt);
    if (withSync.length > 0) {
      const latest = withSync.reduce((a, b) => (a.lastSyncAt! > b.lastSyncAt! ? a : b));
      setLastSyncAt(latest.lastSyncAt ?? null);
      setLastSyncStatus(latest.lastSyncStatus ?? null);
    } else {
      setLastSyncAt(null);
      setLastSyncStatus(null);
    }
  }, [parentId]);

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  useEffect(() => {
    const refreshAfterReturn = () => {
      void loadBootstrapData();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadBootstrapData();
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'kidtasker:google-sync-connected') return;
      if (event.data?.parentId && event.data.parentId !== parentId) return;
      setSyncStatus('Google connected. Refreshing settings...');
      void loadBootstrapData().then(() => {
        setSyncStatus('Google connected.');
      });
    };

    window.addEventListener('focus', refreshAfterReturn);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('focus', refreshAfterReturn);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('message', handleMessage);
    };
  }, [loadBootstrapData]);

  useEffect(() => {
    if (!googlePhotosEnabled) setGoogleAlbumsError('');
  }, [parentId, googlePhotosEnabled]);

  useEffect(() => {
    if (!pickerPolling || !pickerSessionId || !googlePhotosEnabled) return;
    let attempts = 0;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      if (attempts > 24) {
        setPickerPolling(false);
        setGoogleAlbumsError('Picker session timed out waiting for selected photos. Re-open picker and try again.');
        return;
      }
      try {
        let pageToken: string | undefined;
        const selectedItems: Array<{ id: string; baseUrl: string; filename?: string }> = [];
        for (let i = 0; i < 5; i++) {
          const res = await photosClientService.getGooglePickerMediaItems(parentId, pickerSessionId, 50, pageToken);
          selectedItems.push(...(res.items || []));
          if (!res.nextPageToken) break;
          pageToken = res.nextPageToken || undefined;
        }
        if (selectedItems.length === 0) return;
        const result = await photosClientService.importGooglePickerItems(parentId, pickerSessionId, selectedItems);
        if (result.imported === 0 && !result.skipped) {
          return;
        }
        setGoogleAlbumsError(`Auto-import complete: ${result.imported} new photo${result.imported === 1 ? '' : 's'}${result.skipped ? `, ${result.skipped} already imported` : ''}.`);
        setPhotoRefreshToken((n) => n + 1);
        setPickerPolling(false);
      } catch {
        // keep polling for transient picker propagation delays
      }
    };

    const interval = setInterval(() => { void tick(); }, 5000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pickerPolling, pickerSessionId, googlePhotosEnabled, parentId]);

  const handleThemeChange = async (themeId: string) => {
    const previous = activeThemeId;
    setActiveThemeId(themeId);
    try {
      await userService.updateUserTheme(parentId, themeId);
      onThemeChange?.(themeId);
    } catch {
      setActiveThemeId(previous);
    }
  };

  const handleLocationChange = (value: string) => {
    setLocationPreset(value);
    const selected = LOCATION_OPTIONS.find((option) => option.id === value);
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
        locationLat,
        locationLon,
        timezone,
        temperatureUnit,
        timeFormat,
        sleepStart,
        sleepEnd,
        // Only include pin if user entered a new value; backend preserves existing if omitted
        ...(pin.trim() ? { pin } : {}),
        displayRotationEnabled,
        displayRotationInterval,
        screensaverShuffle,
        screensaverDurationSec,
        screensaverCaptions,
        customStoreNames,
        customLocationNames,
        photoCleanupEnabled,
        photoCleanupIntervalHours: Math.max(1, photoCleanupIntervalHours),
        googlePhotosEnabled,
        googlePhotosAlbumId: null,
      };
      await settingsClientService.saveSettings(parentId, data);
      if (pin.trim()) {
        setHasPIN(true);
        setPin('');
        setShowPinInput(false);
      }
      onSaved?.({ parentId, ...data } as FamilySettings);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    if (!connectionId) {
      setSyncStatus('No Google connection found to sync.');
      return;
    }
    setSyncingNow(true);
    setSyncStatus('');
    setSyncResult(null);
    try {
      const res = await syncClientService.syncNow(connectionId);
      setSyncResult(res);
      setLastSyncAt(res.finishedAt);
      setLastSyncStatus(res.failureCount === 0 ? 'ok' : res.successCount > 0 ? 'partial' : 'error');
      if (res.failureCount === 0) {
        setSyncStatus(`Synced: ${res.imported} imported, ${res.updated} updated.`);
      } else {
        setSyncStatus(`Partial sync: ${res.successCount} ok, ${res.failureCount} failed.`);
      }
    } catch {
      setSyncStatus('Sync failed. Check your Google connection.');
    } finally {
      setSyncingNow(false);
    }
  };

  const handleToggleCalendarVisibility = async (calendarId: string) => {
    const current = calendarVisibility[calendarId] ?? true;
    const next = !current;
    setCalendarVisibility(prev => ({ ...prev, [calendarId]: next }));
    try {
      await settingsClientService.setCalendarVisibility(calendarId, next);
    } catch {
      setCalendarVisibility(prev => ({ ...prev, [calendarId]: current }));
    }
  };

  const handleStartGooglePicker = async () => {
    setCreatingPickerSession(true);
    setGoogleAlbumsError('');
    try {
      const session = await photosClientService.createGooglePickerSession(parentId);
      setPickerSessionId(session.sessionId);
      setPickerUri(session.pickerUri);
      setPickerPolling(true);
      window.open(session.pickerUri, '_blank', 'noopener,noreferrer');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGoogleAlbumsError(msg || 'Failed to start Google Photos Picker. Reconnect Google and try again.');
    } finally {
      setCreatingPickerSession(false);
    }
  };

  const handleImportPickerSelection = async () => {
    if (!pickerSessionId) {
      setGoogleAlbumsError('Start Google Photos Picker first, select photos, then import.');
      return;
    }
    setImportingPickerSelection(true);
    setGoogleAlbumsError('');
    try {
      let pageToken: string | undefined;
      const selectedItems: Array<{ id: string; baseUrl: string; filename?: string }> = [];
      for (let i = 0; i < 10; i++) {
        const res = await photosClientService.getGooglePickerMediaItems(parentId, pickerSessionId, 50, pageToken);
        selectedItems.push(...(res.items || []));
        if (!res.nextPageToken) break;
        pageToken = res.nextPageToken || undefined;
      }
      if (selectedItems.length === 0) {
        setGoogleAlbumsError('No selected Google Photos found in this picker session yet. Select photos in the opened picker tab, then import again.');
        return;
      }
      const result = await photosClientService.importGooglePickerItems(parentId, pickerSessionId, selectedItems);
      if (result.imported === 0 && !result.skipped) {
        setGoogleAlbumsError('No finalized photo selections were found yet. In Google Photos Picker, complete your selection and confirm, then import again.');
      } else {
        setGoogleAlbumsError(`Imported ${result.imported} Google photo${result.imported === 1 ? '' : 's'}${result.skipped ? `, ${result.skipped} already imported` : ''}${result.unresolved ? `, ${result.unresolved} unresolved` : ''}.`);
        setPhotoRefreshToken((n) => n + 1);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGoogleAlbumsError(msg || 'Failed to import selected Google Photos.');
    } finally {
      setImportingPickerSelection(false);
    }
  };

  const handlePreviewScreensaver = async () => {
    try {
      const photos = await photosClientService.getPhotos(parentId);
      if (!photos || photos.length === 0) {
        setPreviewMessage('No imported photos yet. Import or upload photos first, then preview.');
        return;
      }
      setPreviewMessage('');
      onPreviewScreensaver?.();
    } catch {
      setPreviewMessage('Could not load photos for preview. Try again.');
    }
  };

  return {
    // Theme
    activeThemeId,
    handleThemeChange,
    // Location
    locationLat,
    locationLon,
    locationPreset,
    detectingLocation,
    handleLocationChange,
    detectLocation,
    // Timezone / prefs
    timezone,
    setTimezone,
    temperatureUnit,
    setTemperatureUnit,
    timeFormat,
    setTimeFormat,
    // Sleep
    sleepStart,
    setSleepStart,
    sleepEnd,
    setSleepEnd,
    // Security / PIN
    pin,
    setPin,
    hasPIN,
    showPinInput,
    setShowPinInput,
    // Save
    saving,
    handleSave,
    // Sync
    syncingNow,
    syncStatus,
    setSyncStatus,
    syncResult,
    lastSyncAt,
    lastSyncStatus,
    showDiagnostics,
    setShowDiagnostics,
    handleSyncNow,
    // Calendars
    calendars,
    calendarVisibility,
    handleToggleCalendarVisibility,
    // Co-parents
    coParents,
    setCoParents,
    coParentInvite,
    setCoParentInvite,
    // Display rotation
    displayRotationEnabled,
    setDisplayRotationEnabled,
    displayRotationInterval,
    setDisplayRotationInterval,
    // Screensaver
    screensaverShuffle,
    setScreensaverShuffle,
    screensaverDurationSec,
    setScreensaverDurationSec,
    screensaverCaptions,
    setScreensaverCaptions,
    previewMessage,
    handlePreviewScreensaver,
    // Photo cleanup
    photoCleanupEnabled,
    setPhotoCleanupEnabled,
    photoCleanupIntervalHours,
    setPhotoCleanupIntervalHours,
    // Google Photos
    googlePhotosEnabled,
    setGooglePhotosEnabled,
    googleAlbumsError,
    pickerSessionId,
    pickerUri,
    creatingPickerSession,
    importingPickerSelection,
    pickerPolling,
    handleStartGooglePicker,
    handleImportPickerSelection,
    photoRefreshToken,
    // Shopping / location tags
    customStoreNames,
    setCustomStoreNames,
    customLocationNames,
    setCustomLocationNames,
  };
}
