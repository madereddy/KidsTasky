import React from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, format } from 'date-fns';
import { CalendarEvent, UserProfile } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  events: CalendarEvent[];
  currentMonth: Date;
  onDayClick: (date: Date) => void;
  memberColorMap: Record<string, string>;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarMonthView({ events, currentMonth, onDayClick, memberColorMap }: Props) {
  const today = new Date();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  const getEventsForDay = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    return events.filter(ev => {
      const evDate = new Date(ev.startTime);
      return format(evDate, 'yyyy-MM-dd') === key;
    });
  };

  const cells: (Date | null)[] = [...Array(firstDay).fill(null), ...days];

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b">
        {DOW.map(d => (
          <div key={d} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="border-b border-r border-slate-100 bg-slate-50/50 min-h-[80px]" />;
          }
          const dayEvents = getEventsForDay(day);
          const isToday = isSameDay(day, today);
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - 3;
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "border-b border-r border-slate-100 p-1 min-h-[80px] cursor-pointer hover:bg-blue-50/60 transition-colors",
                !isSameMonth(day, currentMonth) && "opacity-40"
              )}
            >
              <div className={cn(
                "w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1",
                isToday ? "bg-blue-500 text-white" : "text-slate-700"
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {visible.map(ev => {
                  const color = (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1';
                  return (
                    <div
                      key={ev.id}
                      className="text-[10px] px-1.5 py-0.5 rounded-full truncate text-white font-medium"
                      style={{ backgroundColor: color }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div className="text-[10px] text-slate-400 font-medium pl-1">+{overflow} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
