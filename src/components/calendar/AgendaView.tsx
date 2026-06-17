import React from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarEvent, UserProfile } from '../../types';
import { TimeFormatPref, formatTimeWithPrefs } from '../../lib/dateTimePrefs';
import { AvatarDisplay } from '../shared/AvatarPicker';

interface Props {
  events: CalendarEvent[];
  startDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onRoutineClick?: (event: CalendarEvent) => void;
  memberColorMap: Record<string, string>;
  members: UserProfile[];
  timeFormat?: TimeFormatPref;
  timezone?: string;
  userRole?: 'parent' | 'kid' | 'coparent';
}

export function AgendaView({
  events,
  startDate,
  onEventClick,
  onRoutineClick,
  memberColorMap,
  members = [],
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
                const assignedMember = ev.assignedToId ? members.find((m) => m.uid === ev.assignedToId) : undefined;
                return (
                  <div key={ev.id} onClick={() => onEventClick?.(ev)} className="flex items-start gap-3 px-4 py-3 hover:bg-ui-soft cursor-pointer">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                    {assignedMember && (
                      <AvatarDisplay
                        avatarPreset={assignedMember.avatarPreset}
                        avatarUrl={assignedMember.avatarUrl}
                        name={assignedMember.name}
                        size={20}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ui-primary truncate">{ev.title}</p>
                      <p className="text-xs text-ui-muted mt-0.5">
                        {ev.isAllDay 
                          ? 'All Day' 
                          : `${formatTimeWithPrefs(new Date(ev.startTime), timezone, timeFormat)} - ${formatTimeWithPrefs(new Date(ev.endTime), timezone, timeFormat)}`}
                      </p>
                      {ev.description && <p className="text-xs text-ui-muted-2 mt-1 truncate">{ev.description}</p>}
                      {ev.routineListId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRoutineClick?.(ev);
                          }}
                          className="mt-2 inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-700"
                        >
                          Open Routine
                        </button>
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

