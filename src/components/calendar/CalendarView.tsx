import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addMonths, subMonths, startOfWeek, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay, endOfWeek } from 'date-fns';
import { routinesClientService } from '../../services/routines';
import { CalendarEvent, UserProfile } from '../../types';
import { useSocketStaleData } from '../../hooks/useSocket';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useCalendarData } from './hooks/useCalendarData';
import { useIdleTimers } from './hooks/useIdleTimers';
import { CalendarSkeleton } from '../shared/Skeleton';
import { CalendarErrorBoundary } from './CalendarErrorBoundary';
import { CalendarWallView } from './CalendarWallView';
import { CalendarStandardView } from './CalendarStandardView';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';
type WallFilter = 'today' | 'week' | 'allday';

interface Props {
  parentId: string;
  kids?: UserProfile[];
  memberColorMap?: Record<string, string>;
  isLocked?: boolean;
  userRole?: 'parent' | 'kid' | 'coparent';
}

export function CalendarView(props: Props) {
  return (
    <CalendarErrorBoundary>
      <CalendarViewInner {...props} />
    </CalendarErrorBoundary>
  );
}

function CalendarViewInner({ parentId, kids = [], memberColorMap = {}, isLocked = false, userRole = 'parent' }: Props) {
  const calendarSelectionStorageKey = `kidtasker:calendar:selected:${parentId}`;
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const guard = () => { if (mq.matches) setViewMode(v => (v === 'month' || v === 'week') ? 'day' : v); };
    guard();
    mq.addEventListener('change', guard);
    return () => mq.removeEventListener('change', guard);
  }, []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>();
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(new Set(['all']));
  const [wallFilter, setWallFilter] = useState<WallFilter>('today');
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());
  const calendarSelectionHydratedRef = useRef(false);
  const [showRoutinesModal, setShowRoutinesModal] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [dayMeals, setDayMeals] = useState<any[]>([]); // Simplified for now, useCalendarData handles main sync

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const { isWallMode, setIsWallMode, isCalSleeping, setIsCalSleeping, resetIdleTimers } = useIdleTimers();
  
  const {
    events,
    syncCalendars,
    calendarVisibility,
    timezone,
    temperatureUnit,
    timeFormat,
    forecast,
    routineTemplates,
    listsSummary,
    wallKidProgress,
    wallPhotos,
    lastRefreshedAt,
    loading,
    fetchEvents,
    fetchWallData,
    setRoutineTemplates
  } = useCalendarData(parentId, kids, isWallMode);

  const staleRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wallRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isFullscreen && isKioskMode) setIsKioskMode(false);
  }, [isFullscreen, isKioskMode]);

  useSocketStaleData(['events', 'sync', 'calendar', 'calendars', 'lists', 'tasks'], (data) => {
    const type = data?.type || data?.entity || '';
    const shouldRefreshEvents = !type || ['events', 'sync', 'calendar', 'calendars'].includes(type);

    if (shouldRefreshEvents) {
      if (staleRefreshTimeoutRef.current) clearTimeout(staleRefreshTimeoutRef.current);
      staleRefreshTimeoutRef.current = setTimeout(() => {
        fetchEvents().catch(() => {});
      }, 200);
    }

    if (isWallMode && (['events', 'lists', 'tasks', 'calendar'].includes(type) || !type)) {
      fetchWallData();
    }
  });

  useEffect(() => {
    if (isWallMode) {
      wallRefreshRef.current = setInterval(fetchEvents, 60000);
    } else {
      if (wallRefreshRef.current) clearInterval(wallRefreshRef.current);
    }
    return () => { if (wallRefreshRef.current) clearInterval(wallRefreshRef.current); };
  }, [isWallMode, fetchEvents]);

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
      // ignore
    } finally {
      calendarSelectionHydratedRef.current = true;
    }
  }, [calendarSelectionStorageKey]);

  useEffect(() => {
    if (!calendarSelectionHydratedRef.current) return;
    const payload = selectedCalendarIds.size === 0
      ? { mode: 'all' as const, ids: [] as string[] }
      : { mode: 'custom' as const, ids: Array.from(selectedCalendarIds) };
    try {
      localStorage.setItem(calendarSelectionStorageKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [selectedCalendarIds, calendarSelectionStorageKey]);

  // Sync Calendar Filter logic
  useEffect(() => {
    const enabled = syncCalendars.filter((cal) => Boolean(cal.enabled) && (calendarVisibility[cal.calendarId] ?? true));
    const enabledIds = new Set(enabled.map((cal) => cal.calendarId));

    setSelectedCalendarIds((prev) => {
      const filteredPrev = new Set(Array.from(prev).filter((id) => enabledIds.has(id)));
      if (prev.size === filteredPrev.size && Array.from(prev).every(id => filteredPrev.has(id)) && prev.size > 0) return prev;
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
      const todayEvs = evs.filter((e) => e.startTime <= dayEnd && e.endTime >= dayStart);
      if (todayEvs.length > 0) return todayEvs;
      // Fall back to next 7 days when today is empty so wall display isn't blank
      const weekEnd = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).getTime();
      return evs.filter((e) => e.startTime >= dayStart && e.startTime <= weekEnd);
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

  if (loading) return <CalendarSkeleton />;

  if (isWallMode) {
    return (
      <CalendarWallView
        parentId={parentId}
        kids={kids}
        memberColorMap={memberColorMap}
        userRole={userRole}
        events={calendarFilteredEvents}
        forecast={forecast}
        todaysMeals={dayMeals} // This should be synced from useCalendarData ideally or handle separately
        wallKidProgress={wallKidProgress}
        listsSummary={listsSummary}
        wallPhotos={wallPhotos}
        temperatureUnit={temperatureUnit}
        timeFormat={timeFormat === '24h' ? '24h' : '12h'}
        lastRefreshedAt={lastRefreshedAt}
        isKioskMode={isKioskMode}
        isCalSleeping={isCalSleeping}
        wallFilter={wallFilter}
        setWallFilter={setWallFilter}
        setIsWallMode={setIsWallMode}
        setIsKioskMode={setIsKioskMode}
        setIsCalSleeping={setIsCalSleeping}
        toggleFullscreen={toggleFullscreen}
        resetIdleTimers={resetIdleTimers}
        fetchEvents={fetchEvents}
        setSelectedEvent={setSelectedEvent}
        selectedEvent={selectedEvent}
      />
    );
  }

  return (
    <CalendarStandardView
      parentId={parentId}
      kids={kids}
      memberColorMap={memberColorMap}
      isLocked={isLocked}
      userRole={userRole}
      viewMode={viewMode}
      setViewMode={setViewMode}
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      filteredEvents={filteredEvents}
      forecast={forecast}
      temperatureUnit={temperatureUnit}
      timeFormat={timeFormat}
      timezone={timezone}
      syncCalendars={syncCalendars}
      calendarVisibility={calendarVisibility}
      selectedCalendarIds={selectedCalendarIds}
      setSelectedCalendarIds={setSelectedCalendarIds}
      visibleMemberIds={visibleMemberIds}
      setVisibleMemberIds={setVisibleMemberIds}
      dayMeals={dayMeals}
      lastRefreshedAt={lastRefreshedAt}
      fetchEvents={fetchEvents}
      setIsWallMode={setIsWallMode}
      isKioskMode={isKioskMode}
      setIsKioskMode={setIsKioskMode}
      toggleFullscreen={toggleFullscreen}
      showAddModal={showAddModal}
      setShowAddModal={setShowAddModal}
      selectedEvent={selectedEvent}
      setSelectedEvent={setSelectedEvent}
      showRoutinesModal={showRoutinesModal}
      setShowRoutinesModal={setShowRoutinesModal}
      routineTemplates={routineTemplates}
      setRoutineTemplates={setRoutineTemplates}
      defaultDate={defaultDate}
      setDefaultDate={setDefaultDate}
      defaultStartTime={defaultStartTime}
      setDefaultStartTime={setDefaultStartTime}
      navigatePrev={navigatePrev}
      navigateNext={navigateNext}
      getDateLabel={getDateLabel}
      handleDayClick={handleDayClick}
      handleTimeSlotClick={handleTimeSlotClick}
      onRoutineRefresh={() => routinesClientService.getTemplates(parentId).then(setRoutineTemplates).catch(() => {})}
    />
  );
}
