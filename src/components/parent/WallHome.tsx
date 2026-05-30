import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, UserProfile, Task, TaskCompletion, Homework } from '../../types';
import { eventsClientService } from '../../services/events';
import { tasksClientService } from '../../services/tasks';
import { homeworkClientService } from '../../services/homework';
import { weatherClientService, DailyForecast } from '../../services/weather';
import { settingsClientService } from '../../services/settings';
import { FamilyNote } from '../shared/FamilyNote';
import { WeeklyWeather } from '../calendar/WeeklyWeather';
import { getWeatherInfo } from '../../constants';
import { toDisplayTemp, TemperatureUnitPref } from '../../lib/dateTimePrefs';
import { useSocketStaleData } from '../../hooks/useSocket';
import { cn } from '../../lib/utils';

interface Props {
  parentId: string;
  profile: UserProfile;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
  isLocked: boolean;
  onManage: () => void;
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <div className="text-4xl font-bold tabular-nums">{format(now, 'h:mm')}<span className="text-2xl ml-1">{format(now, 'a')}</span></div>
      <div className="text-sm text-ui-muted mt-1">{format(now, 'EEEE, MMMM d')}</div>
    </div>
  );
}

interface KidProgress {
  kid: UserProfile;
  total: number;
  done: number;
}

export function WallHome({ parentId, profile, kids, memberColorMap, isLocked, onManage }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasksByKid, setTasksByKid] = useState<Record<string, Task[]>>({});
  const [completionsByKid, setCompletionsByKid] = useState<Record<string, TaskCompletion[]>>({});
  const [homework, setHomework] = useState<Homework[]>([]);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [tempUnit, setTempUnit] = useState<TemperatureUnitPref>('celsius');
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayMs = new Date(today).getTime();

  const fetchData = useCallback(async () => {
    try {
      const [evts, hw, settings] = await Promise.all([
        eventsClientService.getEvents(parentId).catch(() => []),
        homeworkClientService.getHomework(parentId).catch(() => []),
        settingsClientService.getSettings(parentId).catch(() => null),
      ]);

      setEvents(evts);
      setHomework(hw);
      if (settings?.temperatureUnit) setTempUnit(settings.temperatureUnit);

      if (settings?.locationLat && settings?.locationLon) {
        weatherClientService.getForecast(settings.locationLat, settings.locationLon)
          .then(setForecast).catch(() => {});
      }

      // Fetch tasks + completions per kid
      const taskMap: Record<string, Task[]> = {};
      const compMap: Record<string, TaskCompletion[]> = {};
      await Promise.all(kids.map(async (kid) => {
        const [tasks, comps] = await Promise.all([
          tasksClientService.getTasksForKid(kid.uid).catch(() => []),
          tasksClientService.getCompletionsForKid(kid.uid, today).catch(() => []),
        ]);
        taskMap[kid.uid] = tasks;
        compMap[kid.uid] = comps;
      }));
      setTasksByKid(taskMap);
      setCompletionsByKid(compMap);
    } catch (e) {
      console.error('[WallHome] fetchData error', e);
    } finally {
      setLoading(false);
    }
  }, [parentId, kids, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useSocketStaleData(useCallback((data: { entity?: string; type?: string }) => {
    fetchData();
  }, [fetchData]));

  const todayEvents = events
    .filter(e => {
      const start = new Date(e.startTime);
      return format(start, 'yyyy-MM-dd') === today;
    })
    .sort((a, b) => a.startTime - b.startTime);

  const todayHomework = homework.filter(h =>
    h.status === 'pending' && h.dueDate <= today
  );

  const todayWeather = forecast.find(f => f.date === today);

  const kidProgress: KidProgress[] = kids.map(kid => {
    const tasks = (tasksByKid[kid.uid] || []).filter(t => t.status !== 'archived');
    const comps = completionsByKid[kid.uid] || [];
    const completedTaskIds = new Set(comps.map(c => c.taskId));
    return {
      kid,
      total: tasks.length,
      done: tasks.filter(t => completedTaskIds.has(t.id)).length,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top strip: clock + weather today */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="md:col-span-1 bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui flex flex-col items-center">
          <LiveClock />
          {todayWeather && (
            <div className="mt-3 flex items-center gap-2 text-sm text-ui-muted">
              <span className="text-lg">{getWeatherInfo(todayWeather.weatherCode).icon}</span>
              <span className="font-semibold text-orange-500">{Math.round(toDisplayTemp(todayWeather.maxTemp, tempUnit))}°</span>
              <span className="text-blue-400">{Math.round(toDisplayTemp(todayWeather.minTemp, tempUnit))}°</span>
              <span>{getWeatherInfo(todayWeather.weatherCode).label}</span>
            </div>
          )}
        </div>

        {/* Today's events */}
        <div className="md:col-span-2 bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
          <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">Today</h2>
          {todayEvents.length === 0 && todayHomework.length === 0 ? (
            <p className="text-ui-muted text-sm">Nothing scheduled today.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {todayEvents.map(event => {
                const memberColor = event.assignedToId ? memberColorMap[event.assignedToId] : null;
                return (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: event.color || memberColor || '#6366f1' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-ui-muted">
                        {event.isAllDay ? 'All day' : format(new Date(event.startTime), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })}
              {todayHomework.map(hw => (
                <div key={hw.id} className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full flex-shrink-0 bg-amber-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">📚 {hw.title}</p>
                    <p className="text-xs text-ui-muted">{hw.subject} · {hw.dueDate === today ? 'Due today' : 'Overdue'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Family task progress */}
      {kids.length > 0 && (
        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
          <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">Chores Today</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kidProgress.map(({ kid, total, done }) => {
              const pct = total === 0 ? 100 : Math.round((done / total) * 100);
              const color = memberColorMap[kid.uid] || '#6366f1';
              const allDone = total > 0 && done >= total;
              return (
                <div key={kid.uid} className={cn(
                  "rounded-xl p-3 border transition-colors",
                  allDone ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700" : "border-ui bg-ui-soft"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold truncate">{kid.name}</span>
                    {allDone && <span className="ml-auto text-emerald-500 text-xs font-bold">✓</span>}
                  </div>
                  <div className="w-full bg-ui-soft-3 rounded-full h-1.5 mb-1">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: allDone ? '#10b981' : color }}
                    />
                  </div>
                  <p className="text-xs text-ui-muted">{done}/{total} done</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom strip: weather forecast + family note */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forecast.length > 0 && (
          <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
            <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">Forecast</h2>
            <WeeklyWeather forecast={forecast} temperatureUnit={tempUnit} />
          </div>
        )}
        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
          <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">Family Note</h2>
          <FamilyNote parentId={parentId} readOnly={isLocked} />
        </div>
      </div>

      {/* Manage link */}
      <div className="flex justify-end">
        <button
          onClick={onManage}
          className="text-xs text-ui-muted hover:text-ui-primary underline transition-colors"
        >
          Manage family members & settings →
        </button>
      </div>
    </div>
  );
}
