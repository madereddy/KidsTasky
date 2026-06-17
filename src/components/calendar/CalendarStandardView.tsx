import React from 'react';
import { ChevronLeft, ChevronRight, Plus, MonitorSmartphone, Maximize2, Minimize2, ListTodo, RefreshCw } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { CalendarEvent, SyncCalendar, UserProfile, AppList, RoutineTemplate } from '../../types';
import { DailyForecast } from '../../services/weather';
import { MealPlanWithRecipe } from '../../services/meals';
import { TemperatureUnitPref, TimeFormatPref, toDisplayTemp } from '../../lib/dateTimePrefs';
import { cn } from '../../lib/utils';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { AgendaView } from './AgendaView';
import { QuickAddModal } from './QuickAddModal';
import { RoutineTemplatesModal } from './RoutineTemplatesModal';
import { EventDetailModal } from './EventDetailModal';
import { EventRoutineSheet } from './EventRoutineSheet';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

interface Props {
  parentId: string;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
  isLocked: boolean;
  userRole?: 'parent' | 'kid' | 'coparent';
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  currentDate: Date;
  setCurrentDate: (d: Date | ((prev: Date) => Date)) => void;
  filteredEvents: CalendarEvent[];
  forecast: DailyForecast[];
  temperatureUnit: TemperatureUnitPref;
  timeFormat: TimeFormatPref;
  timezone: string;
  syncCalendars: SyncCalendar[];
  calendarVisibility: Record<string, boolean>;
  selectedCalendarIds: Set<string>;
  setSelectedCalendarIds: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  visibleMemberIds: Set<string>;
  setVisibleMemberIds: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  dayMeals: MealPlanWithRecipe[];
  lastRefreshedAt: Date | null;
  fetchEvents: () => Promise<void>;
  setIsWallMode: (b: boolean | ((prev: boolean) => boolean)) => void;
  isKioskMode: boolean;
  setIsKioskMode: (b: boolean) => void;
  toggleFullscreen: () => void;
  showAddModal: boolean;
  setShowAddModal: (b: boolean) => void;
  selectedEvent: CalendarEvent | null;
  setSelectedEvent: (e: CalendarEvent | null) => void;
  showRoutinesModal: boolean;
  setShowRoutinesModal: (b: boolean) => void;
  routineTemplates: RoutineTemplate[];
  routineLists: AppList[];
  setRoutineTemplates: (t: RoutineTemplate[]) => void;
  defaultDate?: Date;
  setDefaultDate: (d: Date) => void;
  defaultStartTime?: string;
  setDefaultStartTime: (s: string | undefined) => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  getDateLabel: () => string;
  handleDayClick: (d: Date) => void;
  handleTimeSlotClick: (t: string) => void;
  onRoutineRefresh: () => void;
}

const VIEW_LABELS: { mode: ViewMode; label: string; short: string }[] = [
  { mode: 'month', label: 'Month', short: 'Mo' },
  { mode: 'week', label: 'Week', short: 'Wk' },
  { mode: 'day', label: 'Day', short: 'D' },
  { mode: 'agenda', label: 'Agenda', short: 'Ag' },
];

export function CalendarStandardView({
  parentId,
  kids,
  memberColorMap,
  isLocked,
  userRole,
  viewMode,
  setViewMode,
  currentDate,
  setCurrentDate,
  filteredEvents,
  forecast,
  temperatureUnit,
  timeFormat,
  timezone,
  syncCalendars,
  calendarVisibility,
  selectedCalendarIds,
  setSelectedCalendarIds,
  visibleMemberIds,
  setVisibleMemberIds,
  dayMeals,
  lastRefreshedAt,
  fetchEvents,
  setIsWallMode,
  isKioskMode,
  setIsKioskMode,
  toggleFullscreen,
  showAddModal,
  setShowAddModal,
  selectedEvent,
  setSelectedEvent,
  showRoutinesModal,
  setShowRoutinesModal,
  routineTemplates,
  routineLists,
  setRoutineTemplates,
  defaultDate,
  setDefaultDate,
  defaultStartTime,
  setDefaultStartTime,
  navigatePrev,
  navigateNext,
  getDateLabel,
  handleDayClick,
  handleTimeSlotClick,
  onRoutineRefresh
}: Props) {
  const weekStart = startOfWeek(currentDate);
  const [selectedRoutineEvent, setSelectedRoutineEvent] = React.useState<CalendarEvent | null>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-2xl border border-ui overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ui bg-ui-soft shrink-0">
        <div className="flex items-center gap-1 bg-white border border-ui rounded-xl p-1">
          {VIEW_LABELS.map(({ mode, label, short }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-2 sm:px-3 py-1.5 rounded-lg text-sm font-semibold transition-all',
                viewMode === mode ? 'bg-blue-500 text-white shadow-sm' : 'text-ui-muted hover:text-ui-primary',
                mode === 'month' && 'hidden sm:flex'
              )}
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
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
          <span className="hidden sm:inline text-sm font-semibold text-ui-secondary text-center px-2 sm:min-w-[160px]">{getDateLabel()}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsWallMode((prev) => !prev)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border bg-white text-ui-secondary border-ui hover:bg-ui-soft"
            title="Toggle wall display mode"
          >
            <MonitorSmartphone size={16} /> Wall
          </button>
          <button
            onClick={() => {
              const entering = !isKioskMode;
              setIsKioskMode(entering);
              if (entering) setIsWallMode(true);
              toggleFullscreen();
            }}
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border',
              isKioskMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-ui-secondary border-ui hover:bg-ui-soft'
            )}
            title="Toggle kiosk / fullscreen mode"
          >
            {isKioskMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            Kiosk
          </button>
          {!isLocked && (
            <button
              onClick={() => { setDefaultDate(currentDate); setDefaultStartTime(undefined); setShowAddModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors min-h-[44px] sm:min-w-[100px]"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Quick Add</span>
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

      <div className="flex-1 overflow-hidden">
        {viewMode === 'month' && (
          <CalendarMonthView
            events={filteredEvents}
            currentMonth={currentDate}
            onDayClick={handleDayClick}
            onEventClick={setSelectedEvent}
            onRoutineClick={setSelectedRoutineEvent}
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
            onRoutineClick={setSelectedRoutineEvent}
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
            onRoutineClick={setSelectedRoutineEvent}
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
            onRoutineClick={setSelectedRoutineEvent}
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
          routineLists={routineLists}
          defaultDate={defaultDate}
          defaultStartTime={defaultStartTime}
        />
      )}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          kids={kids}
          routineLists={routineLists}
          userRole={userRole || 'parent'}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => { setSelectedEvent(null); fetchEvents(); }}
        />
      )}
      {selectedRoutineEvent && (
        <EventRoutineSheet
          event={selectedRoutineEvent}
          routineLists={routineLists}
          onClose={() => setSelectedRoutineEvent(null)}
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
          onRefresh={onRoutineRefresh}
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
