import { X, MapPin, Globe, Moon, RefreshCw, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { FamilySettings } from '../../types';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { userService } from '../../services/users';
import { PhotoManager } from './PhotoManager';
import { HouseholdTagManager } from '../shared/HouseholdTagManager';
import { SecuritySettings } from './settings/SecuritySettings';
import { ThemeSettingsSection } from './settings/ThemeSettingsSection';
import { useSettingsController, LOCATION_OPTIONS, TIMEZONES, DEFAULT_LOCATION, findPresetLocation } from '../../hooks/useSettingsController';

// Re-export for any consumers that import these from this module
export { LOCATION_OPTIONS, TIMEZONES, DEFAULT_LOCATION, findPresetLocation };

interface Props {
  parentId: string;
  onClose: () => void;
  onSaved?: (settings: FamilySettings) => void;
  onLockNow?: () => void;
  onPreviewScreensaver?: () => void;
  currentThemeId?: string;
  onThemeChange?: (themeId: string) => void;
}

export function SettingsView({ parentId, onClose, onSaved, onLockNow, onPreviewScreensaver, currentThemeId, onThemeChange }: Props) {
  const { kids, refreshKids: onKidsRefresh } = useFamilyData();

  const {
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
  } = useSettingsController({ parentId, currentThemeId, onSaved, onClose, onThemeChange, onPreviewScreensaver });

  return (
    <div className="fixed inset-0 z-[150] flex">
      <div className="flex-1 bg-ui-deep-50" onClick={onClose} />
      <div className="w-full sm:max-w-md bg-white shadow-2xl flex flex-col overflow-hidden sm:border-l border-ui sm:rounded-l-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-ui-soft shrink-0">
          <h2 className="text-lg font-bold text-ui-primary">Family Settings</h2>
          <button onClick={onClose} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-ui-soft-3 rounded-full transition-colors">
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

          <ThemeSettingsSection
            activeThemeId={activeThemeId}
            onThemeChange={(themeId) => void handleThemeChange(themeId)}
          />

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
                            onClick={() => handleToggleCalendarVisibility(cal.calendarId)}
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
                    onClick={() => {
                      setSyncStatus('Waiting for Google connection…');
                      window.open('/api/sync/connect/google?token=' + encodeURIComponent(localStorage.getItem('kidtasker_token') || ''), '_blank');
                    }}
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
