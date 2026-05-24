import React from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarEvent } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  events: CalendarEvent[];
  startDate: Date;
  memberColorMap: Record<string, string>;
}

export function AgendaView({ events, startDate, memberColorMap }: Props) {
  const endDate = addDays(startDate, 60);

  const grouped: Record<string, CalendarEvent[]> = {};
  events.forEach(ev => {
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
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-lg font-semibold">No upcoming events</p>
        <p className="text-sm mt-1">Add an event to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
      {sortedKeys.map(key => {
        const dayEvents = grouped[key].sort((a, b) => a.startTime - b.startTime);
        return (
          <div key={key}>
            <div className="sticky top-0 bg-slate-50 px-4 py-2 border-b border-slate-200 z-10">
              <p className="text-sm font-bold text-slate-700">
                {format(new Date(key), 'EEEE, MMMM d')}
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {dayEvents.map(ev => {
                const color = (ev.assignedToId && memberColorMap[ev.assignedToId]) || ev.color || '#6366f1';
                return (
                  <div key={ev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{ev.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {format(new Date(ev.startTime), 'h:mm a')} – {format(new Date(ev.endTime), 'h:mm a')}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{ev.description}</p>
                      )}
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
