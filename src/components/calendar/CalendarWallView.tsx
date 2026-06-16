import React, { useMemo, useRef } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { MonitorSmartphone, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { CalendarEvent, UserProfile, AppList } from '../../types';
import { DailyForecast } from '../../services/weather';
import { MealPlanWithRecipe } from '../../services/meals';
import { getEffectiveEventEndTime, isEventCurrentOrUpcoming, TemperatureUnitPref, toDisplayTemp } from '../../lib/dateTimePrefs';
import { cn } from '../../lib/utils';
import { CalSkyLiveClock } from './CalSkyLiveClock';
import { PhotoScreensaver } from '../shared/PhotoScreensaver';
import { ParentalLockOverlay } from '../shared/ParentalLockOverlay';
import { EventDetailModal } from './EventDetailModal';

type WallFilter = 'today' | 'week' | 'allday';

interface Props {
  parentId: string;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
  userRole?: 'parent' | 'kid' | 'coparent';
  events: CalendarEvent[];
  forecast: DailyForecast[];
  todaysMeals: MealPlanWithRecipe[];
  wallKidProgress: Array<{ kid: UserProfile; done: number; total: number }>;
  listsSummary: Array<{ list: AppList; total: number; done: number }>;
  wallPhotos: { id: string; url: string; caption?: string }[];
  temperatureUnit: TemperatureUnitPref;
  timeFormat: '12h' | '24h';
  lastRefreshedAt: Date | null;
  isKioskMode: boolean;
  isCalSleeping: boolean;
  wallFilter: WallFilter;
  setWallFilter: (f: WallFilter) => void;
  setIsWallMode: (b: boolean) => void;
  setIsKioskMode: (b: boolean) => void;
  setIsCalSleeping: (b: boolean) => void;
  toggleFullscreen: () => void;
  resetIdleTimers: () => void;
  fetchEvents: () => Promise<void>;
  setSelectedEvent: (e: CalendarEvent | null) => void;
  selectedEvent: CalendarEvent | null;
}

export function CalendarWallView({
  parentId,
  kids,
  memberColorMap,
  userRole,
  events,
  forecast,
  todaysMeals,
  wallKidProgress,
  listsSummary,
  wallPhotos,
  temperatureUnit,
  timeFormat,
  lastRefreshedAt,
  isKioskMode,
  isCalSleeping,
  wallFilter,
  setWallFilter,
  setIsWallMode,
  setIsKioskMode,
  setIsCalSleeping,
  toggleFullscreen,
  resetIdleTimers,
  fetchEvents,
  setSelectedEvent,
  selectedEvent
}: Props) {
  const exitHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPinToExit, setShowPinToExit] = React.useState(false);
  const use24h = timeFormat === '24h';
  const nowMs = Date.now();

  const countdownEvents = useMemo(() => {
    return events
      .filter((e) => Boolean(e.isCountdown) && e.startTime > nowMs)
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 3);
  }, [events, nowMs]);

  // Build 5-day event groups
  type DayGroup = { label: string; dateStr: string; items: CalendarEvent[] };
  const dayGroups: DayGroup[] = [];
  for (let d = 0; d <= 4; d++) {
    const dt = addDays(new Date(), d);
    const dateStr = format(dt, 'yyyy-MM-dd');
    const label = d === 0 ? 'TODAY' : d === 1 ? 'TOMORROW' : format(dt, 'EEE, MMM d').toUpperCase();
    const dayEvts = events
      .filter((e) => {
        const evDateStr = format(new Date(e.startTime), 'yyyy-MM-dd');
        if (d === 0) return evDateStr === dateStr && isEventCurrentOrUpcoming(e, nowMs);
        return evDateStr === dateStr;
      })
      .sort((a, b) => a.startTime - b.startTime);
    if (dayEvts.length > 0 || d <= 1) {
      dayGroups.push({ label, dateStr, items: dayEvts });
    }
  }

  const wxCodeFor = (code: number | undefined) => {
    const c = code ?? -1;
    const icon = c < 0 ? '' : c === 0 ? '☀️' : c <= 3 ? '⛅' : c <= 48 ? '🌫️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌦️' : '⛈️';
    const desc = c < 0 ? '' : c === 0 ? 'Clear Sky' : c <= 3 ? 'Partly Cloudy' : c <= 48 ? 'Cloudy / Foggy' : c <= 67 ? 'Rainy' : c <= 77 ? 'Snowy' : c <= 82 ? 'Showers' : 'Stormy';
    return { icon, desc };
  };

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todaysWeather = forecast.find((f) => f.date === todayKey);
  const todayWx = wxCodeFor(todaysWeather?.weatherCode);
  const tomorrowKey = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrowWeather = forecast.find((f) => f.date === tomorrowKey);
  const tomorrowWx = wxCodeFor(tomorrowWeather?.weatherCode);

  const isStale = !lastRefreshedAt || (Date.now() - lastRefreshedAt.getTime() > 5 * 60 * 1000);

  const startExitHold = (onHeld: () => void) => () => {
    exitHoldRef.current = setTimeout(onHeld, 1500);
  };
  const cancelExitHold = () => {
    if (exitHoldRef.current) { clearTimeout(exitHoldRef.current); exitHoldRef.current = null; }
  };

  const daysUntil = (ts: number): number => Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="relative flex h-[calc(100vh-200px)] bg-white rounded-2xl border border-ui overflow-hidden shadow-sm">
      {/* Left panel */}
      <div className="w-72 shrink-0 flex flex-col gap-5 p-8 border-r border-ui bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <CalSkyLiveClock use24h={use24h} />
          {isStale && (
            <span className="shrink-0 mt-1 text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
              ⚠ stale
            </span>
          )}
        </div>

        {todaysWeather ? (
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Weather</div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">{todayWx.icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{todayWx.desc}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(toDisplayTemp(todaysWeather.maxTemp, temperatureUnit))}° / {Math.round(toDisplayTemp(todaysWeather.minTemp, temperatureUnit))}°
                </div>
              </div>
            </div>
            {tomorrowWeather && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 pl-0.5">
                <span>{tomorrowWx.icon}</span>
                <span>Tomorrow: {tomorrowWx.desc}, {Math.round(toDisplayTemp(tomorrowWeather.maxTemp, temperatureUnit))}°/{Math.round(toDisplayTemp(tomorrowWeather.minTemp, temperatureUnit))}°</span>
              </div>
            )}
          </div>
        ) : null}

        {todaysMeals.length > 0 && (
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Today's Meals</div>
            <div className="space-y-0.5">
              {todaysMeals.slice(0, 3).map((m, i) => (
                <div key={i} className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-semibold capitalize">{m.mealType}:</span> {m.recipeName || 'Planned'}
                </div>
              ))}
            </div>
          </div>
        )}

        {wallKidProgress.length > 0 && (
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Chores</div>
            <div className="space-y-2">
              {wallKidProgress.map(({ kid, done, total }) => {
                if (total === 0) return null;
                const pct = Math.round((done / total) * 100);
                const color = memberColorMap[kid.uid] || '#6366f1';
                return (
                  <div key={kid.uid}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{kid.name}</span>
                      <span className="text-gray-400">{done}/{total}{done === total ? ' ✓' : ''}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <button
            onMouseDown={startExitHold(() => {
              if (isKioskMode) setShowPinToExit(true);
              else { setIsKioskMode(true); toggleFullscreen(); }
            })}
            onMouseUp={cancelExitHold}
            onMouseLeave={cancelExitHold}
            onTouchStart={startExitHold(() => {
              if (isKioskMode) setShowPinToExit(true);
              else { setIsKioskMode(true); toggleFullscreen(); }
            })}
            onTouchEnd={cancelExitHold}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border select-none',
              isKioskMode ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
            )}
            title="Hold 1.5s to activate"
          >
            {isKioskMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isKioskMode ? 'Exit Kiosk (hold)' : 'Kiosk (hold)'}
          </button>
          <button
            onMouseDown={startExitHold(() => setIsWallMode(false))}
            onMouseUp={cancelExitHold}
            onMouseLeave={cancelExitHold}
            onTouchStart={startExitHold(() => setIsWallMode(false))}
            onTouchEnd={cancelExitHold}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors select-none"
            title="Hold 1.5s to exit"
          >
            <MonitorSmartphone size={16} /> Exit Wall (hold)
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {countdownEvents.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-1">
            {countdownEvents.map((e) => {
              const days = daysUntil(e.startTime);
              const color = (e.assignedToId && memberColorMap[e.assignedToId]) || e.color || '#6366f1';
              return (
                <div key={e.id} className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-white text-sm" style={{ backgroundColor: color }}>
                  <span className="font-black text-lg tabular-nums">{days}</span>
                  <span className="opacity-90 text-xs">day{days !== 1 ? 's' : ''}</span>
                  <span className="font-semibold truncate max-w-[80px]">{e.title}</span>
                </div>
              );
            })}
          </div>
        )}

        {dayGroups.map((group) => (
          <div key={group.dateStr}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 tracking-widest whitespace-nowrap">{group.label}</span>
              <hr className="flex-1 border-gray-200 dark:border-gray-700" />
            </div>
            {group.items.length === 0 ? (
              <p className="text-sm text-gray-400 italic pl-2">No events</p>
            ) : (
              <div className="space-y-1">
                {group.items.map((e) => {
                  const color = (e.assignedToId && memberColorMap[e.assignedToId]) || e.color || '#6366f1';
                  const assignedKid = e.assignedToId ? kids.find((k) => k.uid === e.assignedToId) : null;
                  const timeStr = use24h ? format(new Date(e.startTime), 'H:mm') : format(new Date(e.startTime), 'h:mm a');
                  const effectiveEndTime = getEffectiveEventEndTime(e);
                  const endTimeStr = effectiveEndTime !== e.startTime ? (use24h ? format(new Date(effectiveEndTime), 'H:mm') : format(new Date(effectiveEndTime), 'h:mm a')) : null;
                  return (
                    <div key={e.id} onClick={() => setSelectedEvent(e)} className="flex items-stretch gap-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1.5 cursor-pointer">
                      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{e.title}</span>
                          {assignedKid && (
                            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              {assignedKid.name}
                            </span>
                          )}
                        </div>
                        {!e.isAllDay ? <div className="text-xs text-gray-400">{timeStr}{endTimeStr ? ` – ${endTimeStr}` : ''}</div> : <div className="text-xs text-gray-400">All day</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          kids={kids}
          userRole={userRole || 'parent'}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => { setSelectedEvent(null); void fetchEvents(); }}
        />
      )}

      {showPinToExit && (
        <ParentalLockOverlay
          parentId={parentId}
          onUnlock={() => { setShowPinToExit(false); setIsKioskMode(false); toggleFullscreen(); }}
          onCancel={() => setShowPinToExit(false)}
        />
      )}

      <PhotoScreensaver
        parentId={parentId}
        photos={wallPhotos}
        forceIdle={isCalSleeping}
        onDismiss={() => { setIsCalSleeping(false); resetIdleTimers(); }}
        shuffleEnabled={true}
        displayDurationSec={10}
        showCaptions={true}
      />
    </div>
  );
}
