import React from 'react';
import { format, isToday } from 'date-fns';
import { CalendarEvent, TaskCompletion } from '../../types';
import { cn } from '../../lib/utils';

interface FamilyDashboardBannerProps {
  name: string;
  events: CalendarEvent[];
  completions: TaskCompletion[];
  className?: string;
}

export function FamilyDashboardBanner({ name, events, completions, className }: FamilyDashboardBannerProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayEvents = events.filter(e => isToday(new Date(e.startTime)));
  const pendingApprovals = completions.filter(c => c.approvalStatus === 'pending').length;

  return (
    <div className={cn('rounded-2xl border border-ui bg-white px-4 py-3 flex items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <p className="font-black text-ui-primary truncate">
          {greeting}, {name}!
        </p>
        <p className="text-xs text-ui-muted mt-0.5">{format(new Date(), 'EEEE, MMM d')}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
        {todayEvents.length > 0 && (
          <span className="text-xs font-bold bg-sky-50 text-sky-600 border border-sky-100 px-2.5 py-1 rounded-xl whitespace-nowrap">
            📅 {todayEvents.length} {todayEvents.length === 1 ? 'event' : 'events'}
          </span>
        )}
        {pendingApprovals > 0 && (
          <span className="text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-1 rounded-xl whitespace-nowrap">
            ⏳ {pendingApprovals} waiting
          </span>
        )}
        {todayEvents.length === 0 && pendingApprovals === 0 && (
          <span className="text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-xl whitespace-nowrap">
            ✓ All clear
          </span>
        )}
      </div>
    </div>
  );
}
