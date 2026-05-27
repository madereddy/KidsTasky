import React, { useState, useEffect } from 'react';
import { X, MapPin, Globe, Moon, Lock, RefreshCw, CheckCircle, AlertTriangle, Users, Trash2 } from 'lucide-react';
import { settingsClientService } from '../../services/settings';
import { syncClientService, SyncNowResult } from '../../services/sync';
import { userService } from '../../services/users';
import { inviteService } from '../../services/invites';
import { FamilySettings } from '../../types';
import { PhotoManager } from './PhotoManager';

interface Props {
  parentId: string;
  onClose: () => void;
  onSaved?: (settings: FamilySettings) => void;
  onLockNow?: () => void;
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

export function SettingsView({ parentId, onClose, onSaved, onLockNow }: Props) {
  const [locationLat, setLocationLat] = useState<number>(DEFAULT_LOCATION.lat);
  const [locationLon, setLocationLon] = useState<number>(DEFAULT_LOCATION.lon);
  const [locationPreset, setLocationPreset] = useState<string>(DEFAULT_LOCATION.id);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [sleepStart, setSleepStart] = useState('21:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncResult, setSyncResult] = useState<SyncNowResult | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [coParents, setCoParents] = useState<{uid: string; name: string; email: string}[]>([]);
  const [coParentInvite, setCoParentInvite] = useState<{id: string} | null>(null);
  const [generatingCoInvite, setGeneratingCoInvite] = useState(false);
  const [coInviteCopied, setCoInviteCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      userService.getCoParents(parentId).catch(() => []),
      inviteService.getActiveCoParentInvite(parentId).catch(() => null),
    ]).then(([cp, cpi]) => {
      setCoParents(cp || []);
      setCoParentInvite(cpi || null);
    });

    settingsClientService.getSettings(parentId).then(s => {
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
      if (s.pin) setPin(s.pin);
    }).catch(() => {});
  }, [parentId]);

  useEffect(() => {
    try {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTimezone && TIMEZONES.includes(browserTimezone)) {
        setTimezone(browserTimezone);
      }
    } catch {}
  }, []);

  useEffect(() => {
    syncClientService.getCalendars(parentId).then(() => {}).catch(() => {});
    // Load connections to surface lastSyncAt/lastSyncStatus
    fetch(`/api/settings/${parentId}/connections`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('kidtasker_token')}` },
    })
      .then(r => r.json())
      .then((conns: Array<{ id: string; lastSyncAt?: number; lastSyncStatus?: string }>) => {
        if (conns.length > 0) {
          setConnectionId(conns[0].id);
        }
        const withSync = conns.filter(c => c.lastSyncAt);
        if (withSync.length > 0) {
          const latest = withSync.reduce((a, b) => (a.lastSyncAt! > b.lastSyncAt! ? a : b));
          setLastSyncAt(latest.lastSyncAt ?? null);
          setLastSyncStatus(latest.lastSyncStatus ?? null);
        }
      })
      .catch(() => {});
  }, [parentId]);

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
        pin: pin || null,
      };
      await settingsClientService.saveSettings(parentId, data);
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


  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
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
              <Lock size={16} className="text-amber-500" />
              <h3 className="font-bold text-ui-secondary">Family PIN</h3>
            </div>
            {!showPinInput ? (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-4 h-4 rounded-full bg-ui-soft-3" />
                  ))}
                </div>
                <button
                  onClick={() => setShowPinInput(true)}
                  className="px-3 py-1.5 bg-ui-soft border border-ui text-amber-700 rounded-lg text-sm font-medium hover:bg-ui-soft-2 transition-colors"
                >
                  Change PIN
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4-digit PIN"
                  className="w-32 border border-ui rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-ui-muted-2 mt-1">Enter a 4-digit PIN</p>
              </div>
            )}
          </section>

          {/* Co-Parents */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Users size={16} /> Co-Parents
            </h3>
            {coParents.length > 0 && (
              <ul className="mb-3 space-y-1">
                {coParents.map(cp => (
                  <li key={cp.uid} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                    <span>{cp.name} <span className="text-gray-400">({cp.email})</span></span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove ${cp.name} as co-parent?`)) return;
                        await userService.removeCoParent(cp.uid);
                        setCoParents(prev => prev.filter(c => c.uid !== cp.uid));
                      }}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {coParentInvite ? (
              <div className="flex items-center gap-2">
                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{coParentInvite.id}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(coParentInvite.id);
                    setCoInviteCopied(true);
                    setTimeout(() => setCoInviteCopied(false), 2000);
                  }}
                  className="text-blue-500 text-xs"
                >
                  {coInviteCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <button
                disabled={generatingCoInvite}
                onClick={async () => {
                  setGeneratingCoInvite(true);
                  try {
                    const res = await inviteService.createCoParentInvite(parentId, 'Family');
                    setCoParentInvite({ id: res });
                  } catch (e) {
                    console.error("Failed to generate invite", e);
                  } finally {
                    setGeneratingCoInvite(false);
                  }
                }}
                className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {generatingCoInvite ? 'Generating…' : 'Generate Co-Parent Invite'}
              </button>
            )}
          </div>

          <section>
            <h3 className="font-bold text-ui-secondary mb-2">Display Lock</h3>
            <p className="text-xs text-ui-muted mb-3">Lock this display in read-only mode.</p>
            <button
              onClick={() => onLockNow?.()}
              className="px-3 py-2 bg-ui-dark-2 text-white rounded-lg text-sm font-semibold"
            >
              Lock Display Now
            </button>
          </section>

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
              <div className="mt-2 space-y-1">
                {syncResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">
                    {e.calendarId !== 'connection' ? `Calendar ${e.calendarId}: ` : ''}{e.message}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="font-bold text-ui-secondary mb-2">Family Photos</h3>
            <p className="text-xs text-ui-muted mb-3">These photos are used by the screensaver.</p>
            <PhotoManager parentId={parentId} />
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
