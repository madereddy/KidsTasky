import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addMonths, subMonths, startOfWeek, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, MonitorSmartphone, ListTodo, RefreshCw } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { mealsClientService, MealPlanWithRecipe } from '../../services/meals';
import { settingsClientService } from '../../services/settings';
import { listsClientService } from '../../services/lists';
import { weatherClientService, DailyForecast } from '../../services/weather';
import { routinesClientService } from '../../services/routines';
import { AppList, AppListItem, CalendarEvent, RoutineTemplate, SyncCalendar, UserProfile } from '../../types';
import { TemperatureUnitPref, TimeFormatPref } from '../../lib/dateTimePrefs';
import { cn } from '../../lib/utils';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { AgendaView } from './AgendaView';
import { QuickAddModal } from './QuickAddModal';
import { RoutineTemplatesModal } from './RoutineTemplatesModal';
import { EventDetailModal } from './EventDetailModal';

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

export function CalendarView({ parentId, kids, memberColorMap, isLocked = false, userRole = 'parent' }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
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
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());
  const [listsSummary, setListsSummary] = useState<Array<{ list: AppList; total: number; done: number }>>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [showRoutinesModal, setShowRoutinesModal] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const wallRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = useCallback(async () => {
    const ev = await eventsClientService.getEvents(parentId);
    setEvents(ev || []);
    setLastRefreshedAt(new Date());
  }, [parentId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-refresh events every 60s in wall mode
  useEffect(() => {
    if (isWallMode) {
      wallRefreshRef.current = setInterval(fetchEvents, 60000);
    } else {
      if (wallRefreshRef.current) clearInterval(wallRefreshRef.current);
    }
    return () => { if (wallRefreshRef.current) clearInterval(wallRefreshRef.current); };
  }, [isWallMode, fetchEvents]);

  useEffect(() => {
    if (!isWallMode) return;
    routinesClientService.getTemplates(parentId)
      .then(setRoutineTemplates)
      .catch(() => setRoutineTemplates([]));
  }, [isWallMode, parentId]);

  useEffect(() => {
    settingsClientService.getCalendars(parentId)
      .then((calendars) => setSyncCalendars(calendars || []))
      .catch(() => setSyncCalendars([]));
  }, [parentId]);

  useEffect(() => {
    let mounted = true;
    settingsClientService.getSettings(parentId)
      .then(async (settings) => {
        if (!mounted) return;

        setTimezone(settings.timezone || 'America/Chicago');
        setTemperatureUnit((settings.temperatureUnit as TemperatureUnitPref) || 'celsius');
        setTimeFormat((settings.timeFormat as TimeFormatPref) || '12h');

        if (typeof settings.locationLat === 'number' && typeof settings.locationLon === 'number') {
          const wx = await weatherClientService.getForecast(settings.locationLat, settings.locationLon);
          if (mounted) setForecast(wx || []);
        } else {
          setForecast([]);
        }
      })
      .catch(() => setForecast([]));
    return () => { mounted = false; };
  }, [parentId]);

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

  useEffect(() => {
    let mounted = true;
    listsClientService.getLists(parentId)
      .then(async (lists) => {
        if (!mounted) return;
        const topLists = (lists || []).slice(0, 2);
        const summaries = await Promise.all(topLists.map(async (list) => {
          const items = await listsClientService.getItems(list.id).catch(() => [] as AppListItem[]);
          const total = items.length;
          const done = items.filter((item) => Boolean(item.completed)).length;
          return { list, total, done };
        }));
        if (mounted) setListsSummary(summaries);
      })
      .catch(() => setListsSummary([]));
    return () => { mounted = false; };
  }, [parentId]);

  useEffect(() => {
    const enabled = syncCalendars.filter((cal) => Boolean(cal.enabled));
    const preferredFamily = enabled.filter((cal) => /family|shared|home|household/i.test(cal.name));
    if (preferredFamily.length > 0) {
      setSelectedCalendarIds(new Set(preferredFamily.map((cal) => cal.calendarId)));
    } else if (enabled.length > 0) {
      setSelectedCalendarIds(new Set(enabled.map((cal) => cal.calendarId)));
    } else {
      setSelectedCalendarIds(new Set());
    }
  }, [syncCalendars]);

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
  const enabledSourceCalendarIds = new Set(syncCalendars.filter((cal) => Boolean(cal.enabled)).map((cal) => cal.calendarId));
  const calendarFilteredEvents = selectedCalendarIds.size === 0
    ? visibleEvents.filter((e) => !e.sourceCalendarId || enabledSourceCalendarIds.has(e.sourceCalendarId))
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
      return evs.filter((e) => (e.isAllDay));
    }
    return evs;
  };

  const filteredEvents = applyWallFilter(calendarFilteredEvents);
  const dayKey = format(currentDate, 'yyyy-MM-dd');
  const todaysWeather = forecast.find((f) => f.date === dayKey);
  const todaysMeals = dayMeals;

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
          <span className="text-sm font-semibold text-ui-secondary min-w-[160px] text-center">{getDateLabel()}</span>
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
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors min-h-[40px] min-w-[100px]"
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

      {syncCalendars.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-ui-soft bg-ui-soft shrink-0 flex-wrap">
          {syncCalendars
            .filter((cal) => Boolean(cal.enabled))
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
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <div className="flex items-center gap-1 bg-white border border-ui rounded-xl p-1">
              {(['today', 'week', 'allday'] as WallFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setWallFilter(f)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[36px]',
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
                  High {Math.round(todaysWeather.maxTemp)}° / Low {Math.round(todaysWeather.minTemp)}°
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
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filteredEvents
                  .filter((e) => e.startTime >= Date.now())
                  .sort((a, b) => a.startTime - b.startTime)
                  .slice(0, 5)
                  .map((e) => (
                    <div
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="flex-shrink-0 rounded-xl border border-ui bg-white px-4 py-2 min-w-[160px] cursor-pointer"
                      style={{ borderLeftColor: e.color, borderLeftWidth: 3 }}
                    >
                      <p className="text-xs font-bold text-ui-secondary truncate">{e.title}</p>
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
    </div>
  );
}
