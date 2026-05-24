import React, { useState, useEffect } from 'react';
import { X, MapPin, Globe, Moon, Lock } from 'lucide-react';
import { settingsClientService } from '../../services/settings';
import { FamilySettings } from '../../types';

interface Props {
  parentId: string;
  onClose: () => void;
  onSaved?: (settings: FamilySettings) => void;
}

const TIMEZONES = typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf
  ? (Intl as any).supportedValuesOf('timeZone') as string[]
  : ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];

export function SettingsView({ parentId, onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<FamilySettings | null>(null);
  const [locationLat, setLocationLat] = useState('');
  const [locationLon, setLocationLon] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [sleepStart, setSleepStart] = useState('21:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    settingsClientService.getSettings(parentId).then(s => {
      setSettings(s);
      setLocationLat(String(s.locationLat ?? ''));
      setLocationLon(String(s.locationLon ?? ''));
      setTimezone(s.timezone || 'America/Chicago');
      setSleepStart(s.sleepStart || '21:00');
      setSleepEnd(s.sleepEnd || '07:00');
      if (s.pin) setPin(s.pin);
    }).catch(() => {});
  }, [parentId]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocationLat(String(pos.coords.latitude.toFixed(4)));
        setLocationLon(String(pos.coords.longitude.toFixed(4)));
        setDetectingLocation(false);
      },
      () => setDetectingLocation(false)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Partial<FamilySettings> = {
        locationLat: parseFloat(locationLat) || 37.7749,
        locationLon: parseFloat(locationLon) || -122.4194,
        timezone,
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

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Family Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-blue-500" />
              <h3 className="font-bold text-slate-700">Location</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={locationLat}
                  onChange={e => setLocationLat(e.target.value)}
                  placeholder="37.7749"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={locationLon}
                  onChange={e => setLocationLon(e.target.value)}
                  placeholder="-122.4194"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <button
              onClick={detectLocation}
              disabled={detectingLocation}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              <MapPin size={14} />
              {detectingLocation ? 'Detecting…' : 'Detect my location'}
            </button>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-emerald-500" />
              <h3 className="font-bold text-slate-700">Timezone</h3>
            </div>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Moon size={16} className="text-indigo-500" />
              <h3 className="font-bold text-slate-700">Sleep Hours</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bedtime</label>
                <input
                  type="time"
                  value={sleepStart}
                  onChange={e => setSleepStart(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Wake time</label>
                <input
                  type="time"
                  value={sleepEnd}
                  onChange={e => setSleepEnd(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={16} className="text-amber-500" />
              <h3 className="font-bold text-slate-700">Family PIN</h3>
            </div>
            {!showPinInput ? (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-4 h-4 rounded-full bg-slate-300" />
                  ))}
                </div>
                <button
                  onClick={() => setShowPinInput(true)}
                  className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
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
                  className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-slate-400 mt-1">Enter a 4-digit PIN</p>
              </div>
            )}
          </section>
        </div>

        <div className="px-5 py-4 border-t bg-slate-50 shrink-0">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
