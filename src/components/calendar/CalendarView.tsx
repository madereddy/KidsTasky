import React, { useState, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths, startOfWeek, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { mealsClientService, MealPlanWithRecipe } from '../../services/meals';
import { CalendarEvent, UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { AgendaView } from './AgendaView';
import { AddEventModal } from './AddEventModal';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

interface Props {
  parentId: string;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
}

const VIEW_LABELS: { mode: ViewMode; label: string }[] = [
  { mode: 'month', label: 'Month' },
  { mode: 'week', label: 'Week' },
  { mode: 'day', label: 'Day' },
  { mode: 'agenda', label: 'Agenda' },
];

export function CalendarView({ parentId, kids, memberColorMap }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>();
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(new Set(['all']));
  const [dayMeals, setDayMeals] = useState<MealPlanWithRecipe[]>([]);

  const fetchEvents = useCallback(async () => {
    const ev = await eventsClientService.getEvents(parentId);
    setEvents(ev || []);
  }, [parentId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (viewMode === 'day') {
      const weekStartDate = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');
      const todayStr = format(currentDate, 'yyyy-MM-dd');
      mealsClientService.getMealPlans(parentId, weekStartStr)
        .then(plans => {
          setDayMeals((plans || []).filter(m => m.date === todayStr));
        })
        .catch(() => setDayMeals([]));
    } else {
      setDayMeals([]);
    }
  }, [viewMode, currentDate, parentId]);

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(d => subMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subDays(d, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(d => addMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addDays(d, 1));
  };

  const getDateLabel = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate);
      return `${format(ws, 'MMM d')} – ${format(addDays(ws, 6), 'MMM d, yyyy')}`;
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
    : events.filter(e => !e.assignedToId || visibleMemberIds.has(e.assignedToId));

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {VIEW_LABELS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all",
                viewMode === mode ? "bg-blue-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={navigatePrev} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Today
          </button>
          <button onClick={navigateNext} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[160px] text-center">{getDateLabel()}</span>
        </div>

        <button
          onClick={() => { setDefaultDate(currentDate); setDefaultStartTime(undefined); setShowAddModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} /> Add Event
        </button>
      </div>

      {kids.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-white shrink-0 flex-wrap">
          <button
            onClick={() => setVisibleMemberIds(new Set(['all']))}
            className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors",
              visibleMemberIds.has('all') ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
          >All</button>
          {kids.map(kid => {
            const color = memberColorMap[kid.uid] ?? '#6366f1';
            const active = visibleMemberIds.has(kid.uid);
            return (
              <button
                key={kid.uid}
                onClick={() => {
                  setVisibleMemberIds(prev => {
                    const next = new Set(prev);
                    next.delete('all');
                    if (next.has(kid.uid)) { next.delete(kid.uid); if (next.size === 0) return new Set(['all']); }
                    else next.add(kid.uid);
                    return next;
                  });
                }}
                className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors border",
                  active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}
                style={active ? { backgroundColor: color, borderColor: color } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {kid.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {viewMode === 'month' && (
          <CalendarMonthView
            events={visibleEvents}
            currentMonth={currentDate}
            onDayClick={handleDayClick}
            memberColorMap={memberColorMap}
          />
        )}
        {viewMode === 'week' && (
          <CalendarWeekView
            events={visibleEvents}
            weekStart={weekStart}
            memberColorMap={memberColorMap}
          />
        )}
        {viewMode === 'day' && (
          <CalendarDayView
            events={visibleEvents}
            day={currentDate}
            memberColorMap={memberColorMap}
            onTimeSlotClick={handleTimeSlotClick}
            dayMeals={dayMeals}
          />
        )}
        {viewMode === 'agenda' && (
          <AgendaView
            events={visibleEvents}
            startDate={currentDate}
            memberColorMap={memberColorMap}
          />
        )}
      </div>

      {showAddModal && (
        <AddEventModal
          onClose={() => setShowAddModal(false)}
          onSubmit={fetchEvents}
          kids={kids}
          parentId={parentId}
          defaultDate={defaultDate}
          defaultStartTime={defaultStartTime}
        />
      )}
    </div>
  );
}
