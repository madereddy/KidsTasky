import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, addMonths, subMonths, startOfWeek, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, MonitorSmartphone, ListTodo, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { mealsClientService, MealPlanWithRecipe } from '../../services/meals';
import { settingsClientService } from '../../services/settings';
import { listsClientService } from '../../services/lists';
import { weatherClientService, DailyForecast } from '../../services/weather';
import { routinesClientService } from '../../services/routines';
import { AppList, AppListItem, CalendarEvent, RoutineTemplate, SyncCalendar, Task, TaskCompletion, UserProfile } from '../../types';
import { TemperatureUnitPref, TimeFormatPref, toDisplayTemp } from '../../lib/dateTimePrefs';
import { cn } from '../../lib/utils';
import { tasksClientService } from '../../services/tasks';
import { photosClientService } from '../../services/photos';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { AgendaView } from './AgendaView';
import { QuickAddModal } from './QuickAddModal';
import { RoutineTemplatesModal } from './RoutineTemplatesModal';
import { EventDetailModal } from './EventDetailModal';
import { useSocketStaleData } from '../../hooks/useSocket';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';
import { CalendarSkeleton } from '../shared/Skeleton';
import { PhotoScreensaver } from '../shared/PhotoScreensaver';
import { ParentalLockOverlay } from '../shared/ParentalLockOverlay';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';
type WallFilter = 'today' | 'week' | 'allday';

interface Props {
  parentId: string;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
  isLocked?: boolean;
  userRole?: 'parent' | 'kid';
}

const VIEW_LABELS: { mode: ViewMode; label: string }[] = [
  { mode: 'month', label: 'Month' },
  { mode: 'week', label: 'Week' },
  { mode: 'day', label: 'Day' },
  { mode: 'agenda', label: 'Agenda' },
];

class CalendarErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { 
    console.error('[CalendarErrorBoundary] CRASH:', error, errorInfo); 
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 text-center bg-white rounded-2xl border border-rose-200">
          <h2 className="text-xl font-bold text-rose-600 mb-2">Calendar Unavailable</h2>
          <p className="text-ui-muted mb-4">Something went wrong while loading the calendar.</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-ui-soft rounded-lg font-bold">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CalSkyLiveClock({ use24h = false }: { use24h?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="text-6xl font-black tabular-nums leading-none text-gray-900 dark:text-white">
        {format(now, use24h ? 'H:mm' : 'h:mm')}
        {!use24h && <span className="text-2xl font-semibold ml-2 text-gray-400 dark:text-gray-500">{format(now, 'a')}</span>}
      </div>
      <div className="mt-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">
        {format(now, 'EEEE')}
      </div>
      <div className="text-base font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
        {format(now, 'MMMM d, yyyy')}
      </div>
    </div>
  );
}

export function CalendarView(props: Props) {
  return (
    <CalendarErrorBoundary>
      <CalendarViewInner {...props} />
    </CalendarErrorBoundary>
  );
}

function CalendarViewInner({ parentId, kids, memberColorMap, isLocked = false, userRole = 'parent' }: Props) {
  const calendarSelectionStorageKey = `kidtasker:calendar:selected:${parentId}`;
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>();
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(new Set(['all']));
  const [dayMeals, setDayMeals] = useState<MealPlanWithRecipe[]>([]);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnitPref>('celsius');
  const [timeFormat, setTimeFormat] = useState<TimeFormatPref>('12h');
  const [isWallMode, setIsWallMode] = useState(false);
  const [wallFilter, setWallFilter] = useState<WallFilter>('today');
  const [syncCalendars, setSyncCalendars] = useState<SyncCalendar[]>([]);
  const [calendarVisibility, setCalendarVisibility] = useState<Record<string, boolean>>({});
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());
  const calendarSelectionHydratedRef = useRef(false);
  const [listsSummary, setListsSummary] = useState<Array<{ list: AppList; total: number; done: number }>>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [showRoutinesModal, setShowRoutinesModal] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isCalSleeping, setIsCalSleeping] = useState(false);
  const [showPinToExit, setShowPinToExit] = useState(false);
  const [wallKidProgress, setWallKidProgress] = useState<Array<{ kid: UserProfile; done: number; total: number }>>([]);
  const [wallPhotos, setWallPhotos] = useState<{ id: string; url: string; caption?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const exitHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const WALL_IDLE_MS = 5 * 60 * 1000;   // 5 min idle → wall mode
  const SLEEP_IDLE_MS = 15 * 60 * 1000; // 15 min idle → sleep

  const wallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wallRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  useWakeLock(isKioskMode);

  const resetIdleTimers = useCallback(() => {
    setIsCalSleeping(false);
    if (wallTimerRef.current) clearTimeout(wallTimerRef.current);
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    wallTimerRef.current = setTimeout(() => setIsWallMode(true), WALL_IDLE_MS);
    sleepTimerRef.current = setTimeout(() => setIsCalSleeping(true), SLEEP_IDLE_MS);
  }, []); // stable — setters never change

  useEffect(() => {
    const evts = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const;
    evts.forEach((e) => document.addEventListener(e, resetIdleTimers, { passive: true }));
    resetIdleTimers();
    return () => {
      evts.forEach((e) => document.removeEventListener(e, resetIdleTimers));
      if (wallTimerRef.current) clearTimeout(wallTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [resetIdleTimers]);

  const fetchEvents = useCallback(async () => {
    try {
      const ev = await eventsClientService.getEvents(parentId);
      setEvents(ev || []);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('[CalendarView] fetchEvents error', err);
    }
  }, [parentId]);

  const isInitialMount = useRef(true);

  // CONSOLIDATED INITIALIZATION
  useEffect(() => { 
    const init = async () => {
      if (isInitialMount.current) {
        setLoading(true);
        isInitialMount.current = false;
      }
      
      // Safety: always stop loading after 5s no matter what
      const timer = setTimeout(() => {
        setLoading(false);
      }, 5000);

      try {
        await Promise.allSettled([
          fetchEvents(),
          settingsClientService.getCalendars(parentId).then(c => setSyncCalendars(c || [])),
          settingsClientService.getCalendarVisibility().then(rows => {
            const map: Record<string, boolean> = {};
            if (Array.isArray(rows)) {
              rows.forEach(r => map[r.calendarId] = Number(r.isVisible) === 1);
            }
            setCalendarVisibility(map);
          }),
          settingsClientService.getSettings(parentId).then(async (settings) => {
            if (!settings) return;
            setTimezone(settings.timezone || 'America/Chicago');
            setTemperatureUnit((settings.temperatureUnit as TemperatureUnitPref) || 'celsius');
            setTimeFormat((settings.timeFormat as TimeFormatPref) || '12h');
            if (typeof settings.locationLat === 'number' && typeof settings.locationLon === 'number') {
              try {
                const wx = await weatherClientService.getForecast(settings.locationLat, settings.locationLon);
                setForecast(wx || []);
              } catch (wxErr) {
                console.error('[CalendarView] weather error', wxErr);
              }
            }
          })
        ]);
        
        // Secondary data for Wall Mode
        if (isWallMode) {
          void routinesClientService.getTemplates(parentId).then(setRoutineTemplates);
          void listsClientService.getLists(parentId).then(async (lists) => {
            const topLists = (lists || []).slice(0, 2);
            const summaries = await Promise.all(topLists.map(async (list) => {
              const items = await listsClientService.getItems(list.id).catch(() => [] as AppListItem[]);
              const total = items.length;
              const done = items.filter((item) => Boolean(item.completed)).length;
              return { list, total, done };
            }));
            setListsSummary(summaries);
          });
          // Chore progress per kid
          void tasksClientService.getTasksForParent(parentId).then(async (allTasks) => {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const progress = await Promise.all(kids.map(async (kid) => {
              const kidTasks = (allTasks || []).filter((t: Task) =>
                (t.assignedKidId === kid.uid || t.assignedKidId === 'all') && t.status !== 'archived'
              );
              const comps: TaskCompletion[] = await tasksClientService.getCompletionsForKid(kid.uid, todayStr).catch(() => []);
              const completedIds = new Set(comps.map((c) => c.taskId));
              return { kid, total: kidTasks.length, done: kidTasks.filter((t: Task) => completedIds.has(t.id)).length };
            }));
            setWallKidProgress(progress);
          }).catch(() => {});
          // Photos for screensaver
          void photosClientService.getPhotos(parentId).then((photos) => {
            setWallPhotos((photos || []).map((p: { id: string; url: string; caption?: string }) => ({ id: p.id, url: p.url, caption: p.caption })));
          }).catch(() => {});
        }

      } catch (err) {
        console.error('[CalendarView] initialization error', err);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    };
    init();
  }, [fetchEvents, parentId, isWallMode]);

  useEffect(() => {
    if (!isFullscreen && isKioskMode) setIsKioskMode(false);
  }, [isFullscreen, isKioskMode]);

  useEffect(() => {
    if (isKioskMode) document.body.classList.add('kiosk-mode');
    else document.body.classList.remove('kiosk-mode');
    return () => document.body.classList.remove('kiosk-mode');
  }, [isKioskMode]);

  useSocketStaleData(['events', 'sync', 'calendar', 'calendars', 'lists', 'tasks'], (data) => {
    const type = data?.type || data?.entity || '';
    const shouldRefreshEvents =
      !type ||
      type === 'events' ||
      type === 'sync' ||
      type === 'calendar' ||
      type === 'calendars';

    if (shouldRefreshEvents) {
      if (staleRefreshTimeoutRef.current) clearTimeout(staleRefreshTimeoutRef.current);
      staleRefreshTimeoutRef.current = setTimeout(() => {
        fetchEvents().catch(() => {});
      }, 200);
    }

    if (isWallMode && (type === 'events' || type === 'lists' || type === 'tasks' || type === 'calendar' || !type)) {
      routinesClientService.getTemplates(parentId).then(setRoutineTemplates).catch(() => {});
      listsClientService.getLists(parentId)
        .then(async (lists) => {
          const topLists = (lists || []).slice(0, 2);
          const summaries = await Promise.all(topLists.map(async (list) => {
            const items = await listsClientService.getItems(list.id).catch(() => [] as AppListItem[]);
            const total = items.length;
            const done = items.filter((item) => Boolean(item.completed)).length;
            return { list, total, done };
          }));
          setListsSummary(summaries);
        })
        .catch(() => {});
    }
  });

  useEffect(() => {
    return () => {
      if (staleRefreshTimeoutRef.current) clearTimeout(staleRefreshTimeoutRef.current);
    };
  }, []);

  // Auto-refresh events every 60s in wall mode
  useEffect(() => {
    if (isWallMode) {
      wallRefreshRef.current = setInterval(fetchEvents, 60000);
    } else {
      if (wallRefreshRef.current) clearInterval(wallRefreshRef.current);
    }
    return () => { if (wallRefreshRef.current) clearInterval(wallRefreshRef.current); };
  }, [isWallMode, fetchEvents]);

  // Meals effect
  useEffect(() => {
    if (viewMode === 'day' || isWallMode) {
      const weekStartDate = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');
      const todayStr = format(currentDate, 'yyyy-MM-dd');
      mealsClientService.getMealPlans(parentId, weekStartStr)
        .then((plans) => {
          setDayMeals((plans || []).filter((m) => m.date === todayStr));
        })
        .catch(() => setDayMeals([]));
    } else {
      setDayMeals([]);
    }
  }, [viewMode, currentDate, parentId, isWallMode]);

  // Local Selection Persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem(calendarSelectionStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { mode?: 'all' | 'custom'; ids?: string[] };
        if (parsed.mode === 'custom' && Array.isArray(parsed.ids)) {
          setSelectedCalendarIds(new Set(parsed.ids));
        } else {
          setSelectedCalendarIds(new Set());
        }
      }
    } catch {
      // ignore invalid local state
    } finally {
      calendarSelectionHydratedRef.current = true;
    }
  }, [calendarSelectionStorageKey]);

  useEffect(() => {
    if (!calendarSelectionHydratedRef.current) return;
    const payload =
      selectedCalendarIds.size === 0
        ? { mode: 'all' as const, ids: [] as string[] }
        : { mode: 'custom' as const, ids: Array.from(selectedCalendarIds) };
    try {
      localStorage.setItem(calendarSelectionStorageKey, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, [selectedCalendarIds, calendarSelectionStorageKey]);

  // Sync Calendar Filter logic
  useEffect(() => {
    const enabled = syncCalendars.filter((cal) => Boolean(cal.enabled) && (calendarVisibility[cal.calendarId] ?? true));
    const enabledIds = new Set(enabled.map((cal) => cal.calendarId));

    setSelectedCalendarIds((prev) => {
      const filteredPrev = new Set(Array.from(prev).filter((id) => enabledIds.has(id)));
      
      const isSame = prev.size === filteredPrev.size && Array.from(prev).every(id => filteredPrev.has(id));
      if (isSame && prev.size > 0) return prev;

      if (prev.size > 0) return filteredPrev;
      if (calendarSelectionHydratedRef.current) return prev;

      const preferredFamily = enabled.filter((cal) => /family|shared|home|household/i.test(cal.name));
      if (preferredFamily.length > 0) return new Set(preferredFamily.map((cal) => cal.calendarId));
      if (enabled.length > 0) return new Set(enabled.map((cal) => cal.calendarId));
      return new Set();
    });
  }, [syncCalendars, calendarVisibility]);

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate((d) => subMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate((d) => addMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const getDateLabel = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate);
      return `${format(ws, 'MMM d')} - ${format(addDays(ws, 6), 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  const handleTimeSlotClick = (time: string) => {
    setDefaultDate(currentDate);
    setDefaultStartTime(time);
    setShowAddModal(true);
  };

  const weekStart = startOfWeek(currentDate);

  const visibleEvents = visibleMemberIds.has('all')
    ? events
    : events.filter((e) => !e.assignedToId || visibleMemberIds.has(e.assignedToId));
    
  const enabledVisibleCalendarIds = new Set(
    syncCalendars
      .filter((cal) => Boolean(cal.enabled) && (calendarVisibility[cal.calendarId] ?? true))
      .map((cal) => cal.calendarId)
  );
  
  const calendarFilteredEvents = selectedCalendarIds.size === 0
    ? visibleEvents.filter((e) => !e.sourceCalendarId || enabledVisibleCalendarIds.has(e.sourceCalendarId))
    : visibleEvents.filter((e) => !e.sourceCalendarId || selectedCalendarIds.has(e.sourceCalendarId));

  const applyWallFilter = (evs: CalendarEvent[]): CalendarEvent[] => {
    if (!isWallMode) return evs;
    const now = new Date();
    if (wallFilter === 'today') {
      const dayStart = startOfDay(now).getTime();
      const dayEnd = endOfDay(now).getTime();
      return evs.filter((e) => e.startTime <= dayEnd && e.endTime >= dayStart);
    }
    if (wallFilter === 'week') {
      const wStart = startOfWeek(now, { weekStartsOn: 1 }).getTime();
      const wEnd = endOfWeek(now, { weekStartsOn: 1 }).getTime();
      return evs.filter((e) => e.startTime <= wEnd && e.endTime >= wStart);
    }
    if (wallFilter === 'allday') {
      return evs.filter((e) => Boolean(e.isAllDay));
    }
    return evs;
  };

  const filteredEvents = applyWallFilter(calendarFilteredEvents);
  
  const countdownEvents = useMemo(() => {
    const now = Date.now();
    return calendarFilteredEvents
      .filter((e) => Boolean(e.isCountdown) && e.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 3);
  }, [calendarFilteredEvents]);

  const daysUntil = (ts: number): number => Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
  const dayKey = format(currentDate, 'yyyy-MM-dd');
  const todaysWeather = forecast.find((f) => f.date === dayKey);
  const todaysMeals = dayMeals;

  if (loading) {
    return <CalendarSkeleton />;
  }

  if (isWallMode) {
    const nowMs = Date.now();
    const use24h = timeFormat === '24h';

    // Build 5-day event groups
    type DayGroup = { label: string; dateStr: string; items: CalendarEvent[] };
    const dayGroups: DayGroup[] = [];
    for (let d = 0; d <= 4; d++) {
      const dt = addDays(new Date(), d);
      const dateStr = format(dt, 'yyyy-MM-dd');
      const label = d === 0 ? 'TODAY' : d === 1 ? 'TOMORROW' : format(dt, 'EEE, MMM d').toUpperCase();
      const dayEvts = calendarFilteredEvents
        .filter((e) => {
          const evDateStr = format(new Date(e.startTime), 'yyyy-MM-dd');
          if (d === 0) return evDateStr === dateStr && e.startTime >= nowMs;
          return evDateStr === dateStr;
        })
        .sort((a, b) => a.startTime - b.startTime);
      if (dayEvts.length > 0 || d <= 1) {
        dayGroups.push({ label, dateStr, items: dayEvts });
      }
    }

    // Weather helpers
    const wxCodeFor = (code: number | undefined) => {
      const c = code ?? -1;
      const icon = c < 0 ? '' : c === 0 ? '☀️' : c <= 3 ? '⛅' : c <= 48 ? '🌫️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌦️' : '⛈️';
      const desc = c < 0 ? '' : c === 0 ? 'Clear Sky' : c <= 3 ? 'Partly Cloudy' : c <= 48 ? 'Cloudy / Foggy' : c <= 67 ? 'Rainy' : c <= 77 ? 'Snowy' : c <= 82 ? 'Showers' : 'Stormy';
      return { icon, desc };
    };
    const todayWx = wxCodeFor(todaysWeather?.weatherCode);
    const tomorrowKey = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const tomorrowWeather = forecast.find((f) => f.date === tomorrowKey);
    const tomorrowWx = wxCodeFor(tomorrowWeather?.weatherCode);

    // Stale indicator: warn if last refresh >5 min ago
    const isStale = !lastRefreshedAt || (Date.now() - lastRefreshedAt.getTime() > 5 * 60 * 1000);

    // Long-press helpers for exit buttons
    const startExitHold = (onHeld: () => void) => () => {
      exitHoldRef.current = setTimeout(onHeld, 1500);
    };
    const cancelExitHold = () => {
      if (exitHoldRef.current) { clearTimeout(exitHoldRef.current); exitHoldRef.current = null; }
    };

    return (
      <div className="relative flex h-[calc(100vh-200px)] bg-white rounded-2xl border border-ui overflow-hidden shadow-sm">
        {/* Left panel */}
        <div className="w-72 shrink-0 flex flex-col gap-5 p-8 border-r border-ui bg-gray-50 dark:bg-gray-900 overflow-y-auto">
          {/* Clock + stale badge */}
          <div className="flex items-start justify-between gap-2">
            <CalSkyLiveClock use24h={use24h} />
            {isStale && (
              <span className="shrink-0 mt-1 text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
                ⚠ stale
              </span>
            )}
          </div>

          {/* Weather — today + tomorrow */}
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

          {/* Today's meals */}
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

          {/* Chore progress per kid */}
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

          {/* Exit buttons — hold 1.5s to activate (prevents accidental tap) */}
          <div className="mt-auto flex flex-col gap-2">
            <button
              onMouseDown={startExitHold(() => {
                if (isKioskMode) {
                  setShowPinToExit(true);
                } else {
                  setIsKioskMode(true);
                  toggleFullscreen();
                }
              })}
              onMouseUp={cancelExitHold}
              onMouseLeave={cancelExitHold}
              onTouchStart={startExitHold(() => {
                if (isKioskMode) {
                  setShowPinToExit(true);
                } else {
                  setIsKioskMode(true);
                  toggleFullscreen();
                }
              })}
              onTouchEnd={cancelExitHold}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border select-none',
                isKioskMode
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
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

        {/* Right panel — countdowns + 5-day agenda */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Countdown events */}
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

          {/* Day groups */}
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
                    const timeStr = use24h
                      ? format(new Date(e.startTime), 'H:mm')
                      : format(new Date(e.startTime), 'h:mm a');
                    const endTimeStr = (e.endTime && e.endTime !== e.startTime)
                      ? (use24h ? format(new Date(e.endTime), 'H:mm') : format(new Date(e.endTime), 'h:mm a'))
                      : null;
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
                          {!e.isAllDay ? (
                            <div className="text-xs text-gray-400">
                              {timeStr}{endTimeStr ? ` – ${endTimeStr}` : ''}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">All day</div>
                          )}
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
            userRole={userRole}
            onClose={() => setSelectedEvent(null)}
            onUpdated={() => { setSelectedEvent(null); void fetchEvents(); }}
          />
        )}

        {/* PIN gate for kiosk exit */}
        {showPinToExit && (
          <ParentalLockOverlay
            parentId={parentId}
            onUnlock={() => {
              setShowPinToExit(false);
              setIsKioskMode(false);
              toggleFullscreen();
            }}
            onCancel={() => setShowPinToExit(false)}
          />
        )}

        {/* Photo screensaver (falls back to plain dark overlay if no photos) */}
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

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-2xl border border-ui overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ui bg-ui-soft shrink-0">
        <div className="flex items-center gap-1 bg-white border border-ui rounded-xl p-1">
          {VIEW_LABELS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all',
                viewMode === mode ? 'bg-blue-500 text-white shadow-sm' : 'text-ui-muted hover:text-ui-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={navigatePrev} className="p-2 hover:bg-ui-soft-3 rounded-full transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm font-semibold bg-white border border-ui rounded-lg hover:bg-ui-soft transition-colors"
          >
            Today
          </button>
          <button onClick={navigateNext} className="p-2 hover:bg-ui-soft-3 rounded-full transition-colors">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold text-ui-secondary text-center px-2 sm:min-w-[160px]">{getDateLabel()}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsWallMode((prev) => !prev)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border',
              isWallMode ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'
            )}
            title="Toggle wall display mode"
          >
            <MonitorSmartphone size={16} /> Wall
          </button>
          <button
            onClick={() => {
              const entering = !isKioskMode;
              setIsKioskMode(entering);
              if (entering) {
                setIsWallMode(true);
              }
              toggleFullscreen();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border',
              isKioskMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'
            )}
            title="Toggle kiosk / fullscreen mode"
          >
            {isKioskMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            Kiosk
          </button>
          {isWallMode && (
            <button
              onClick={() => setShowRoutinesModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-ui-secondary rounded-xl text-sm font-semibold border border-ui hover:bg-ui-soft transition-colors"
              title="Quick add from routine templates"
            >
              <ListTodo size={16} /> Routines
            </button>
          )}
          {isLocked && <span className="text-xs font-semibold text-ui-muted bg-ui-soft-3 rounded-full px-2 py-1">View only</span>}
          {!isLocked && (
            <button
              onClick={() => { setDefaultDate(currentDate); setDefaultStartTime(undefined); setShowAddModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors min-h-[44px] min-w-[100px]"
            >
              <Plus size={16} /> Quick Add
            </button>
          )}
        </div>
      </div>

      {kids.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-ui-soft bg-white shrink-0 flex-wrap">
          <button
            onClick={() => setVisibleMemberIds(new Set(['all']))}
            className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-colors',
              visibleMemberIds.has('all') ? 'bg-blue-500 text-white' : 'bg-ui-soft-2 text-ui-muted hover:bg-ui-soft-3')}
          >All</button>
          {kids.map((kid) => {
            const color = memberColorMap[kid.uid] ?? '#6366f1';
            const active = visibleMemberIds.has(kid.uid);
            return (
              <button
                key={kid.uid}
                onClick={() => {
                  setVisibleMemberIds((prev) => {
                    const next = new Set(prev);
                    next.delete('all');
                    if (next.has(kid.uid)) { next.delete(kid.uid); if (next.size === 0) return new Set(['all']); }
                    else next.add(kid.uid);
                    return next;
                  });
                }}
                className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors border',
                  active ? 'text-white border-transparent' : 'bg-white text-ui-secondary border-ui hover:border-ui-soft-strong')}
                style={active ? { backgroundColor: color, borderColor: color } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {kid.name}
              </button>
            );
          })}
        </div>
      )}

      {!isWallMode && syncCalendars.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-ui-soft bg-ui-soft shrink-0 flex-wrap">
          {syncCalendars
            .filter((cal) => Boolean(cal.enabled) && (calendarVisibility[cal.calendarId] ?? true))
            .map((cal) => {
              const active = selectedCalendarIds.size === 0 || selectedCalendarIds.has(cal.calendarId);
              const calColor = cal.color || '#6366f1';
              return (
                <button
                  key={cal.id}
                  onClick={() => {
                    setSelectedCalendarIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(cal.calendarId)) next.delete(cal.calendarId);
                      else next.add(cal.calendarId);
                      return next;
                    });
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                    active ? 'text-white border-transparent' : 'bg-white text-ui-secondary border-ui hover:border-ui-soft-strong'
                  )}
                  style={active ? { backgroundColor: calColor, borderColor: calColor } : {}}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: calColor }} />
                  {cal.name}
                </button>
              );
            })}
        </div>
      )}

      {isWallMode && (
        <div className="flex flex-col border-b border-ui-soft bg-ui-soft">
          <div className="flex gap-3 px-4 py-2 overflow-x-auto min-h-[72px] items-center">
            {countdownEvents.length === 0 ? (
              <p className="text-sm text-ui-muted-2 italic">No countdowns set.</p>
            ) : (
              countdownEvents.map((event) => {
                const days = daysUntil(event.startTime);
                return (
                  <div
                    key={event.id}
                    className="flex-shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-white"
                    style={{ backgroundColor: (event.assignedToId && memberColorMap[event.assignedToId]) || event.color || '#6366f1' }}
                  >
                    <div className="text-center">
                      <span className="text-2xl font-bold">{days}</span>
                      <span className="text-xs ml-1 opacity-90">day{days !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-sm font-medium truncate max-w-[90px] sm:max-w-[100px]">{event.title}</div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <div className="flex items-center gap-1 bg-white border border-ui rounded-xl p-1">
              {(['today', 'week', 'allday'] as WallFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setWallFilter(f)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px]',
                    wallFilter === f ? 'bg-blue-500 text-white shadow-sm' : 'text-ui-muted hover:text-ui-primary'
                  )}
                >
                  {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Day'}
                </button>
              ))}
            </div>
            {lastRefreshedAt && (
              <span className="flex items-center gap-1 text-xs text-ui-muted">
                <RefreshCw size={12} />
                {format(lastRefreshedAt, 'h:mm a')}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 px-4 py-3">
            <div className="rounded-xl border border-ui bg-white p-4">
              <p className="text-xs font-bold text-ui-muted uppercase tracking-widest mb-1">Today Weather</p>
              {todaysWeather ? (
                <p className="text-sm font-semibold text-ui-secondary">
                  High {Math.round(toDisplayTemp(todaysWeather.maxTemp, temperatureUnit))}° / Low {Math.round(toDisplayTemp(todaysWeather.minTemp, temperatureUnit))}°
                </p>
              ) : <p className="text-sm text-ui-muted">No forecast available</p>}
            </div>
            <div className="rounded-xl border border-ui bg-white p-4">
              <p className="text-xs font-bold text-ui-muted uppercase tracking-widest mb-1">Today Meals</p>
              {todaysMeals.length > 0 ? (
                <p className="text-sm text-ui-secondary">
                  {todaysMeals.slice(0, 2).map((m) => `${m.mealType}: ${m.recipeName || 'Planned'}`).join(' • ')}
                </p>
              ) : <p className="text-sm text-ui-muted">No meals planned today</p>}
            </div>
            <div className="rounded-xl border border-ui bg-white p-4">
              <p className="text-xs font-bold text-ui-muted uppercase tracking-widest mb-1">Lists</p>
              {listsSummary.length > 0 ? (
                <p className="text-sm text-ui-secondary">
                  {listsSummary.map((s) => `${s.list.title}: ${s.done}/${s.total}`).join(' • ')}
                </p>
              ) : <p className="text-sm text-ui-muted">No lists available</p>}
            </div>
          </div>
          {filteredEvents.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs font-bold text-ui-muted uppercase tracking-widest mb-2">Next Up</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredEvents
                  .filter((e) => e.startTime >= Date.now())
                  .sort((a, b) => a.startTime - b.startTime)
                  .slice(0, 9)
                  .map((e) => (
                    <div
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="rounded-xl border border-ui bg-white px-4 py-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: (e.assignedToId && memberColorMap[e.assignedToId]) || e.color || '#6366f1' }} />
                        <p className="text-xs font-bold text-ui-secondary truncate">{e.title}</p>
                      </div>
                      <p className="text-xs text-ui-muted">{format(new Date(e.startTime), 'MMM d, h:mm a')}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {viewMode === 'month' && (
          <CalendarMonthView
            events={filteredEvents}
            currentMonth={currentDate}
            onDayClick={handleDayClick}
            onEventClick={setSelectedEvent}
            memberColorMap={memberColorMap}
            forecast={forecast}
            temperatureUnit={temperatureUnit}
          />
        )}
        {viewMode === 'week' && (
          <CalendarWeekView
            events={filteredEvents}
            weekStart={weekStart}
            onEventClick={setSelectedEvent}
            memberColorMap={memberColorMap}
            forecast={forecast}
            temperatureUnit={temperatureUnit}
            timeFormat={timeFormat}
            timezone={timezone}
          />
        )}
        {viewMode === 'day' && (
          <CalendarDayView
            events={filteredEvents}
            day={currentDate}
            onEventClick={setSelectedEvent}
            memberColorMap={memberColorMap}
            onTimeSlotClick={handleTimeSlotClick}
            dayMeals={dayMeals}
            weatherEntry={forecast.find((f) => f.date === format(currentDate, 'yyyy-MM-dd'))}
            temperatureUnit={temperatureUnit}
            timeFormat={timeFormat}
            timezone={timezone}
          />
        )}
        {viewMode === 'agenda' && (
          <AgendaView
            events={filteredEvents}
            startDate={currentDate}
            onEventClick={setSelectedEvent}
            memberColorMap={memberColorMap}
            members={kids}
            timeFormat={timeFormat}
            timezone={timezone}
          />
        )}
      </div>

      {showAddModal && !isLocked && (
        <QuickAddModal
          onClose={() => setShowAddModal(false)}
          onSubmit={fetchEvents}
          kids={kids}
          parentId={parentId}
          defaultDate={defaultDate}
          defaultStartTime={defaultStartTime}
        />
      )}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          kids={kids}
          userRole={userRole}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => { setSelectedEvent(null); fetchEvents(); }}
        />
      )}
      {showRoutinesModal && (
        <RoutineTemplatesModal
          parentId={parentId}
          kids={kids}
          templates={routineTemplates}
          onClose={() => setShowRoutinesModal(false)}
          onApply={(template) => {
            const today = new Date();
            const [hours, minutes] = (template.defaultStartTime || '09:00').split(':').map(Number);
            today.setHours(hours, minutes, 0, 0);
            setDefaultDate(today);
            setDefaultStartTime(template.defaultStartTime || '09:00');
            setShowRoutinesModal(false);
            setShowAddModal(true);
          }}
          onRefresh={() => routinesClientService.getTemplates(parentId).then(setRoutineTemplates).catch(() => {})}
        />
      )}
      {isKioskMode && (
        <button
          onClick={() => { setIsKioskMode(false); toggleFullscreen(); }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-ui-deep-80 text-white rounded-full text-xs font-bold hover:bg-ui-dark-95 transition-colors backdrop-blur-sm"
        >
          <Minimize2 size={14} /> Exit Kiosk
        </button>
      )}
    </div>
  );
}
