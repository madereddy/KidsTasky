import React, { useState, useEffect } from 'react';
import { X, MapPin, Globe, Moon, RefreshCw, CheckCircle, AlertTriangle, Users, Palette } from 'lucide-react';
import { settingsClientService } from '../../services/settings';
import { syncClientService, SyncNowResult } from '../../services/sync';
import { userService } from '../../services/users';
import { inviteService } from '../../services/invites';
import { photosClientService } from '../../services/photos';
import { FamilySettings, SyncCalendar } from '../../types';
import { THEMES } from '../../constants';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { PhotoManager } from './PhotoManager';
import { HouseholdTagManager } from '../shared/HouseholdTagManager';
import { SecuritySettings } from './settings/SecuritySettings';

interface Props {
  parentId: string;
  onClose: () => void;
  onSaved?: (settings: FamilySettings) => void;
  onLockNow?: () => void;
  onPreviewScreensaver?: () => void;
  currentThemeId?: string;
  onThemeChange?: (themeId: string) => void;
}

const TIMEZONES = typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf
  ? (Intl as any).supportedValuesOf('timeZone') as string[]
  : ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];

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

const DEFAULT_LOCATION = LOCATION_OPTIONS[1];

function findPresetLocation(lat?: number, lon?: number) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }
  return LOCATION_OPTIONS.find((option) => Math.abs(option.lat - lat) < 0.01 && Math.abs(option.lon - lon) < 0.01) || null;
}

export function SettingsView({ parentId, onClose, onSaved, onLockNow, onPreviewScreensaver, currentThemeId, onThemeChange }: Props) {
  const { kids, refreshKids: onKidsRefresh } = useFamilyData();
  const [activeThemeId, setActiveThemeId] = React.useState(currentThemeId || 'space_commander');

  const handleThemeChange = async (themeId: string) => {
    setActiveThemeId(themeId);
    try {
      await userService.updateUserTheme(parentId, themeId);
      onThemeChange?.(themeId);
    } catch {
      setActiveThemeId(activeThemeId);
    }
  };
  const [locationLat, setLocationLat] = useState<number>(DEFAULT_LOCATION.lat);
  const [locationLon, setLocationLon] = useState<number>(DEFAULT_LOCATION.lon);
  const [locationPreset, setLocationPreset] = useState<string>(DEFAULT_LOCATION.id);
  const [timezone, setTimezone] = useState('America/Chicago');
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

  useEffect(() => {
    Promise.all([
      userService.getCoParents(parentId).catch(() => []),
      inviteService.getActiveCoParentInvite(parentId).catch(() => null),
      settingsClientService.getBootstrap(parentId).catch(() => null),
    ]).then(([cp, cpi, bootstrap]) => {
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
      (bootstrap.calendarVisibility || []).forEach((v: any) => {
        visMap[v.calendarId] = Number(v.isVisible) === 1;
      });
      setCalendarVisibility(visMap);

      const conns = bootstrap.connections || [];
      if (conns.length > 0) setConnectionId(conns[0].id);
      const withSync = conns.filter((c: any) => c.lastSyncAt);
      if (withSync.length > 0) {
        const latest = withSync.reduce((a: any, b: any) => (a.lastSyncAt! > b.lastSyncAt! ? a : b));
        setLastSyncAt(latest.lastSyncAt ?? null);
        setLastSyncStatus(latest.lastSyncStatus ?? null);
      }
    });
  }, [parentId]);

  useEffect(() => {
    if (!googlePhotosEnabled) setGoogleAlbumsError('');
  }, [parentId, googlePhotosEnabled]);

  const handleStartGooglePicker = async () => {
    setCreatingPickerSession(true);
    setGoogleAlbumsError('');
    try {
      const session = await photosClientService.createGooglePickerSession(parentId);
      setPickerSessionId(session.sessionId);
      setPickerUri(session.pickerUri);
      setPickerPolling(true);
      window.open(session.pickerUri, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setGoogleAlbumsError(String(e?.message || 'Failed to start Google Photos Picker. Reconnect Google and try again.'));
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
    } catch (e: any) {
      setGoogleAlbumsError(String(e?.message || 'Failed to import selected Google Photos.'));
    } finally {
      setImportingPickerSelection(false);
    }
  };

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

  useEffect(() => {
    try {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTimezone && TIMEZONES.includes(browserTimezone)) {
        setTimezone(browserTimezone);
      }
    } catch {}
  }, []);

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

  const handleLocationChange = (value: string) => {
    setLocationPreset(value);
    const selected = LOCATION_OPTIONS.find((option) => option.id === value);
    if (!selected) return;
    setLocationLat(selected.lat);
    setLocationLon(selected.lon);
    setTimezone(selected.timezone);
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

  const handleToggleVisibility = async (calendarId: string) => {
    const current = calendarVisibility[calendarId] ?? true;
    const next = !current;
    setCalendarVisibility(prev => ({ ...prev, [calendarId]: next }));
    try {
      await settingsClientService.setCalendarVisibility(calendarId, next);
    } catch {
      setCalendarVisibility(prev => ({ ...prev, [calendarId]: current }));
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

  return (
    <div className="fixed inset-0 z-[150] flex">
      <div className="flex-1 bg-ui-deep-50" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden border-l border-ui rounded-l-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-ui-soft shrink-0">
          <h2 className="text-lg font-bold text-ui-primary">Family Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-ui-soft-3 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-blue-500" />
              <h3 className="font-bold text-ui-secondary">Location</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="col-span-2">
                <label className="block text-xs text-ui-muted mb-1">City or region</label>
                <select
                  value={locationPreset}
                  onChange={e => handleLocationChange(e.target.value)}
                  className="w-full border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {LOCATION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                  <option value="custom">Detected custom location</option>
                </select>
                {locationPreset === 'custom' && (
                  <p className="text-xs text-ui-muted mt-2">
                    Using detected coordinates ({locationLat.toFixed(4)}, {locationLon.toFixed(4)}).
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={detectLocation}
              disabled={detectingLocation}
              className="flex items-center gap-2 px-3 py-2 bg-ui-soft text-blue-600 border border-ui rounded-lg text-sm font-medium hover:bg-ui-soft-2 transition-colors disabled:opacity-60"
            >
              <MapPin size={14} />
              {detectingLocation ? 'Detecting...' : 'Detect my location'}
            </button>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-emerald-500" />
              <h3 className="font-bold text-ui-secondary">Timezone</h3>
            </div>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="font-bold text-ui-secondary mb-3">Weather Unit</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTemperatureUnit('celsius')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${temperatureUnit === 'celsius' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'}`}
              >
                Celsius (°C)
              </button>
              <button
                onClick={() => setTemperatureUnit('fahrenheit')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${temperatureUnit === 'fahrenheit' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'}`}
              >
                Fahrenheit (°F)
              </button>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-ui-secondary mb-3">Clock Format</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTimeFormat('12h')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${timeFormat === '12h' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'}`}
              >
                12-hour
              </button>
              <button
                onClick={() => setTimeFormat('24h')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${timeFormat === '24h' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'}`}
              >
                24-hour
              </button>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Palette size={16} className="text-violet-500" />
              <h3 className="font-bold text-ui-secondary">Theme</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(theme => {
                const active = activeThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => void handleThemeChange(theme.id)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all text-left ${active ? 'border-blue-500 bg-blue-50' : 'border-ui bg-white hover:border-blue-300'}`}
                  >
                    <div
                      className="w-full h-8 rounded-lg border border-black/5"
                      style={{ background: theme.bg }}
                    />
                    <span className="text-base leading-none">{theme.icon}</span>
                    <span className={`text-[11px] font-semibold text-center leading-tight ${active ? 'text-blue-600' : 'text-ui-secondary'}`}>{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Moon size={16} className="text-indigo-500" />
              <h3 className="font-bold text-ui-secondary">Sleep Hours</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ui-muted mb-1">Bedtime</label>
                <input
                  type="time"
                  value={sleepStart}
                  onChange={e => setSleepStart(e.target.value)}
                  className="w-full border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-ui-muted mb-1">Wake time</label>
                <input
                  type="time"
                  value={sleepEnd}
                  onChange={e => setSleepEnd(e.target.value)}
                  className="w-full border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🖥</span>
              <h3 className="font-bold text-ui-secondary">Wall Display Rotation</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={displayRotationEnabled}
                  onChange={e => setDisplayRotationEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-ui"
                />
                <span className="text-sm text-ui-secondary">Auto-rotate wall display</span>
              </label>
              {displayRotationEnabled && (
                <div>
                  <label className="block text-xs text-ui-muted mb-1">Slide interval</label>
                  <select
                    value={displayRotationInterval}
                    onChange={e => setDisplayRotationInterval(Number(e.target.value))}
                    className="border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          {kids.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-purple-500" />
                <h3 className="font-bold text-ui-secondary">Member Colors</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {kids.map(kid => (
                  <div key={kid.uid} className="flex items-center gap-2">
                    <label className="text-sm text-ui-secondary">{kid.name}</label>
                    <input
                      type="color"
                      defaultValue={kid.color || '#6366f1'}
                      onChange={async (e) => {
                        await userService.setMemberColor(kid.uid, e.target.value);
                        onKidsRefresh?.();
                      }}
                      className="w-8 h-8 rounded cursor-pointer border border-ui"
                      title={`${kid.name}'s color`}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <SecuritySettings
            parentId={parentId}
            hasPIN={hasPIN}
            pin={pin}
            setPin={setPin}
            showPinInput={showPinInput}
            setShowPinInput={setShowPinInput}
            onLockNow={onLockNow}
            coParents={coParents}
            setCoParents={setCoParents}
            coParentInvite={coParentInvite}
            setCoParentInvite={setCoParentInvite}
          />

          <section>
            <h3 className="font-bold text-ui-secondary mb-2">Calendar Sync</h3>
            {lastSyncAt && (
              <div className="flex items-center gap-1.5 mb-2">
                {lastSyncStatus === 'ok' && <CheckCircle size={13} className="text-emerald-500 shrink-0" />}
                {lastSyncStatus === 'partial' && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                {lastSyncStatus === 'error' && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                <span className="text-xs text-ui-muted">
                  Last sync: {new Date(lastSyncAt).toLocaleString()}
                  {lastSyncStatus && lastSyncStatus !== 'ok' && ` (${lastSyncStatus})`}
                </span>
              </div>
            )}
            <button
              onClick={handleSyncNow}
              disabled={syncingNow}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <RefreshCw size={14} className={syncingNow ? 'animate-spin' : ''} />
              {syncingNow ? 'Syncing...' : 'Sync Now'}
            </button>
            {syncStatus && (
              <p className={`text-xs mt-2 ${syncResult && syncResult.failureCount > 0 ? 'text-amber-600' : 'text-ui-muted'}`}>
                {syncStatus}
              </p>
            )}
            {syncResult && syncResult.errors.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="text-xs text-blue-600 font-medium hover:underline focus:outline-none"
                >
                  {showDiagnostics ? 'Hide Diagnostic' : 'Show Diagnostic'}
                </button>
                {showDiagnostics && (
                  <div className="mt-2 space-y-1">
                    {syncResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-500 bg-red-50 rounded px-2 py-1 break-words">
                        {e.calendarId !== 'connection' ? `Calendar ${e.calendarId}: ` : ''}{e.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {calendars.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-ui-secondary mb-3">Wall Visibility</h4>
                <div className="space-y-3">
                  {calendars.map(cal => {
                    const isVisible = calendarVisibility[cal.calendarId] ?? true;
                    return (
                      <div key={cal.id} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-2 text-ui-primary flex-1">{cal.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ui-muted">{isVisible ? 'Visible' : 'Hidden'}</span>
                          <button
                            onClick={() => handleToggleVisibility(cal.calendarId)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isVisible ? 'bg-blue-500' : 'bg-ui-soft-3'}`}
                            aria-label={`Toggle visibility for ${cal.name}`}
                            aria-pressed={isVisible}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isVisible ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
          <section>
            <h3 className="font-bold text-ui-secondary mb-2">Family Photos</h3>
            <p className="text-xs text-ui-muted mb-3">These photos are used by the screensaver.</p>
            <div className="mb-4 p-3 rounded-lg border border-ui bg-ui-soft space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-ui-secondary">Scheduled Cleanup</h4>
                  <p className="text-xs text-ui-muted">Hard-delete orphaned photo rows/files on a schedule.</p>
                </div>
                <button
                  onClick={() => setPhotoCleanupEnabled(v => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${photoCleanupEnabled ? 'bg-blue-500' : 'bg-ui-soft-3'}`}
                  aria-label="Toggle photo cleanup"
                  aria-pressed={photoCleanupEnabled}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${photoCleanupEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div>
                <label className="block text-xs text-ui-muted mb-1">Cleanup interval (hours)</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={photoCleanupIntervalHours}
                  onChange={(e) => setPhotoCleanupIntervalHours(Math.max(1, Number(e.target.value || 1)))}
                  className="w-28 border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="mb-4 p-3 rounded-lg border border-ui bg-ui-soft space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-ui-secondary">Google Photos Import</h4>
                  <p className="text-xs text-ui-muted">Import selected Google Photos into Family Photos.</p>
                </div>
                <button
                  onClick={() => setGooglePhotosEnabled(v => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${googlePhotosEnabled ? 'bg-blue-500' : 'bg-ui-soft-3'}`}
                  aria-label="Toggle Google Photos"
                  aria-pressed={googlePhotosEnabled}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${googlePhotosEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {googlePhotosEnabled && (
                <div className="space-y-2">
                  <button
                    onClick={() => window.open('/api/sync/connect/google?token=' + encodeURIComponent(localStorage.getItem('kidtasker_token') || ''), '_blank')}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600"
                  >
                    Reconnect Google (Calendar + Photos scopes)
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleStartGooglePicker}
                      disabled={creatingPickerSession}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {creatingPickerSession ? 'Opening Picker...' : 'Open Google Photos Picker'}
                    </button>
                    <button
                      onClick={handleImportPickerSelection}
                      disabled={importingPickerSelection || !pickerSessionId}
                      className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-500 disabled:opacity-60"
                    >
                      {importingPickerSelection ? 'Importing...' : 'Import Selected Photos'}
                    </button>
                  </div>
                  {pickerSessionId && (
                    <p className="text-xs text-ui-muted">
                      Picker session ready: <span className="font-mono">{pickerSessionId}</span>{' '}
                      {pickerUri && <a href={pickerUri} target="_blank" rel="noreferrer" className="text-blue-600 underline">open picker</a>}
                      {pickerPolling ? ' (auto-import polling active)' : ''}
                    </p>
                  )}
                  {googleAlbumsError && <p className="text-xs text-rose-600">{googleAlbumsError}</p>}
                </div>
              )}
            </div>
            <PhotoManager
              parentId={parentId}
              refreshToken={photoRefreshToken}
            />
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ui-muted mb-1">Slide duration</label>
                  <select
                    value={screensaverDurationSec}
                    onChange={e => setScreensaverDurationSec(Number(e.target.value))}
                    className="w-full border border-ui rounded-lg px-2 py-1.5 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={20}>20 seconds</option>
                    <option value={30}>30 seconds</option>
                  </select>
                </div>
                <div className="space-y-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={screensaverShuffle} onChange={e => setScreensaverShuffle(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-xs text-ui-secondary">Shuffle photos</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={screensaverCaptions} onChange={e => setScreensaverCaptions(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-xs text-ui-secondary">Show captions</span>
                  </label>
                </div>
              </div>
              <button
                onClick={handlePreviewScreensaver}
                className="px-3 py-2 bg-ui-soft border border-ui rounded-lg text-sm font-semibold hover:bg-ui-soft-2 transition-colors"
              >
                Preview Screensaver
              </button>
              {previewMessage && <p className="text-xs text-rose-600 mt-2">{previewMessage}</p>}
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t bg-ui-soft shrink-0">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-ui-soft-2 text-ui-secondary rounded-xl text-sm font-semibold hover:bg-ui-soft-3 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
