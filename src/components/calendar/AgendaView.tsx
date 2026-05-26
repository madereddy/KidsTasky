import React from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarEvent } from '../../types';
import { TimeFormatPref, formatTimeWithPrefs } from '../../lib/dateTimePrefs';

interface Props {
  events: CalendarEvent[];
  startDate: Date;
  onEventClick?: (event: CalendarEvent) => void;
  memberColorMap: Record<string, string>;
  timeFormat?: TimeFormatPref;
  timezone?: string;
}

export function AgendaView({
  events,
  startDate,
  onEventClick,
  memberColorMap,
  timeFormat = '12h',
  timezone = 'America/Chicago'
}: Props) {
  const endDate = addDays(startDate, 60);

  const grouped: Record<string, CalendarEvent[]> = {};
  events.forEach((ev) => {
    const evDate = new Date(ev.startTime);
    if (evDate >= startOfDay(startDate) && evDate <= endDate) {
      const key = format(evDate, 'yyyy-MM-dd');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    }
  });

  const sortedKeys = Object.keys(grouped).sort();

  if (sortedKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ui-muted-2">
        <p className="text-lg font-semibold">No upcoming events</p>
        <p className="text-sm mt-1">Add an event to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
      {sortedKeys.map((key) => {
        const dayEvents = grouped[key].sort((a, b) => a.startTime - b.startTime);
        return (
          <div key={key}>
            <div className="sticky top-0 bg-ui-soft px-4 py-2 border-b border-ui z-10">
              <p className="text-sm font-bold text-ui-secondary">{format(new Date(key + 'T00:00:00'), 'EEEE, MMMM d')}</p>
            </div>
            <div className="divide-y divide-slate-50">
              {dayEvents.map((ev) => {
                const color = (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1';
                return (
                  <div key={ev.id} onClick={() => onEventClick?.(ev)} className="flex items-start gap-3 px-4 py-3 hover:bg-ui-soft cursor-pointer">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ui-primary truncate">{ev.title}</p>
                      <p className="text-xs text-ui-muted mt-0.5">
                        {ev.isAllDay 
                          ? 'All Day' 
                          : `${formatTimeWithPrefs(new Date(ev.startTime), timezone, timeFormat)} - ${formatTimeWithPrefs(new Date(ev.endTime), timezone, timeFormat)}`}
                      </p>
                      {ev.description && <p className="text-xs text-ui-muted-2 mt-1 truncate">{ev.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

