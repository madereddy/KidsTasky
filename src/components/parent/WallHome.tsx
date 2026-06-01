import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, UserProfile, Task, TaskCompletion, Homework } from '../../types';
import { eventsClientService } from '../../services/events';
import { tasksClientService } from '../../services/tasks';
import { homeworkClientService } from '../../services/homework';
import { weatherClientService, DailyForecast, HourlyForecastEntry } from '../../services/weather';
import { settingsClientService } from '../../services/settings';
import { FamilyNote } from '../shared/FamilyNote';
import { WeeklyWeather } from '../calendar/WeeklyWeather';
import { WeeklyChoreGrid } from '../shared/WeeklyChoreGrid';
import { DisplayCarousel } from '../shared/DisplayCarousel';
import { getWeatherInfo } from '../../constants';
import { toDisplayTemp, TemperatureUnitPref } from '../../lib/dateTimePrefs';
import { useSocketStaleData } from '../../hooks/useSocket';
import { useDisplayMode } from '../../contexts/DisplayContext';
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
  const { isWallMode } = useDisplayMode();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center" data-testid="wall-clock">
      <div className={cn("font-bold tabular-nums", isWallMode ? "text-7xl" : "text-4xl")}>
        {format(now, 'h:mm')}<span className={cn("ml-1", isWallMode ? "text-4xl" : "text-2xl")}>{format(now, 'a')}</span>
      </div>
      <div className={cn("text-ui-muted mt-1", isWallMode ? "text-base" : "text-sm")}>{format(now, 'EEEE, MMMM d')}</div>
    </div>
  );
}

interface KidProgress {
  kid: UserProfile;
  total: number;
  done: number;
}

export function WallHome({ parentId, profile, kids, memberColorMap, isLocked, onManage }: Props) {
  const { isWallMode } = useDisplayMode();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasksByKid, setTasksByKid] = useState<Record<string, Task[]>>({});
  const [completionsByKid, setCompletionsByKid] = useState<Record<string, TaskCompletion[]>>({});
  const [homework, setHomework] = useState<Homework[]>([]);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [hourlyToday, setHourlyToday] = useState<HourlyForecastEntry[]>([]);
  const [tempUnit, setTempUnit] = useState<TemperatureUnitPref>('celsius');
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [rotationInterval, setRotationInterval] = useState(30);
  const [rotationOrder, setRotationOrder] = useState<string[]>(['chores', 'calendar', 'weather']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayMs = new Date(today).getTime();

  const fetchData = useCallback(async () => {
    try {
      setLoadError('');
      const [evts, hw, settings] = await Promise.all([
        eventsClientService.getEvents(parentId).catch(() => []),
        homeworkClientService.getHomework(parentId).catch(() => []),
        settingsClientService.getSettings(parentId).catch(() => null),
      ]);

      setEvents(evts);
      setHomework(hw);
      if (settings?.temperatureUnit) setTempUnit(settings.temperatureUnit);
      if (settings?.displayRotationEnabled !== undefined) setRotationEnabled(Boolean(settings.displayRotationEnabled));
      if (settings?.displayRotationInterval) setRotationInterval(settings.displayRotationInterval);
      if (settings?.displayRotationOrder) {
        try { setRotationOrder(JSON.parse(settings.displayRotationOrder)); } catch {}
      }

      if (settings?.locationLat && settings?.locationLon) {
        weatherClientService.getForecastWithHourly(settings.locationLat, settings.locationLon)
          .then((wx) => {
            setForecast(wx.daily || []);
            setHourlyToday(wx.hourlyToday || []);
          }).catch(() => {
            setForecast([]);
            setHourlyToday([]);
          });
      } else {
        setForecast([]);
        setHourlyToday([]);
      }
    } catch (e) {
      console.error('[WallHome] fetchData error', e);
      setLoadError('Could not load home data.');
    } finally {
      setLoading(false);
    }
  }, [parentId, kids, today]);

  const fetchKidTaskData = useCallback(async () => {
    const taskMap: Record<string, Task[]> = {};
    const compMap: Record<string, TaskCompletion[]> = {};
    await Promise.allSettled(kids.map(async (kid) => {
      const [tasks, comps] = await Promise.all([
        tasksClientService.getTasksForKid(kid.uid).catch(() => []),
        tasksClientService.getCompletionsForKid(kid.uid, today).catch(() => []),
      ]);
      taskMap[kid.uid] = tasks;
      compMap[kid.uid] = comps;
    }));
    setTasksByKid(taskMap);
    setCompletionsByKid(compMap);
  }, [kids, today]);

  useEffect(() => {
    fetchData();
    void fetchKidTaskData();
  }, [fetchData, fetchKidTaskData]);

  useSocketStaleData(['events', 'homework', 'tasks', 'completions', 'weather', 'settings'], useCallback((data: { entity?: string; type?: string }) => {
    const signal = data.type || data.entity;
    if (signal === 'tasks' || signal === 'completions') {
      void fetchKidTaskData();
      return;
    }
    fetchData();
  }, [fetchData, fetchKidTaskData]));

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
  const now = new Date();
  const nowHour = now.getHours();
  const remainingHourly = hourlyToday.filter((hour) => {
    const hourDate = new Date(hour.time);
    return !Number.isNaN(hourDate.getTime()) && hourDate.getHours() >= nowHour;
  });
  const weatherByHour = new Map(remainingHourly.map((hour) => [new Date(hour.time).getHours(), hour]));

  const getEventWeather = (event: CalendarEvent): HourlyForecastEntry | null => {
    if (event.isAllDay) return null;
    const eventDate = new Date(event.startTime);
    const eventHour = eventDate.getHours();
    const direct = weatherByHour.get(eventHour);
    if (direct) return direct;
    let best: HourlyForecastEntry | null = null;
    let delta = Number.POSITIVE_INFINITY;
    for (const hour of remainingHourly) {
      const hourDate = new Date(hour.time);
      const diff = Math.abs(hourDate.getHours() - eventHour);
      if (diff < delta) {
        delta = diff;
        best = hour;
      }
    }
    return best;
  };

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

  const allTasks = Object.values(tasksByKid).flat();
  const allCompletions = Object.values(completionsByKid).flat();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        {loadError && <button onClick={() => void fetchData()} className="px-3 py-1.5 rounded-lg border border-ui text-sm text-ui-secondary">Retry</button>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 flex items-center justify-between">
          <p className="text-sm text-rose-700">{loadError}</p>
          <button onClick={() => void fetchData()} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold">Retry</button>
        </div>
      )}
      {/* Top strip: clock + weather today */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="md:col-span-1 bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui flex flex-col items-center">
          <LiveClock />
          {todayWeather && (
            <div className={cn("mt-3 flex items-center gap-2 text-ui-muted", isWallMode ? "text-base" : "text-sm")}>
              <span className="text-lg">{getWeatherInfo(todayWeather.weatherCode).icon}</span>
              <span className="font-semibold text-orange-500">{Math.round(toDisplayTemp(todayWeather.maxTemp, tempUnit))}°</span>
              <span className="text-blue-400">{Math.round(toDisplayTemp(todayWeather.minTemp, tempUnit))}°</span>
              <span>{getWeatherInfo(todayWeather.weatherCode).label}</span>
            </div>
          )}
        </div>

        {/* Today's events */}
        <div className="md:col-span-2 bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
          <h2 className={cn("font-semibold text-ui-muted uppercase tracking-wide mb-3", isWallMode ? "text-base" : "text-sm")}>Today</h2>
          {remainingHourly.length > 0 && (
            <div className="mb-3 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                {remainingHourly.map((hour) => (
                  <div key={hour.time} className="px-2 py-1 rounded-lg bg-ui-soft text-xs text-ui-secondary flex items-center gap-1.5">
                    <span>{format(new Date(hour.time), 'h a')}</span>
                    <span>{getWeatherInfo(hour.weatherCode).icon}</span>
                    <span>{Math.round(toDisplayTemp(hour.temp, tempUnit))}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {todayEvents.length === 0 && todayHomework.length === 0 ? (
            <p className={cn("text-ui-muted", isWallMode ? "text-base" : "text-sm")}>Nothing scheduled today.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {todayEvents.map(event => {
                const memberColor = event.assignedToId ? memberColorMap[event.assignedToId] : null;
                const eventWeather = getEventWeather(event);
                return (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: event.color || memberColor || '#6366f1' }} />
                    <div className="min-w-0">
                      <p className={cn("font-medium truncate", isWallMode ? "text-base" : "text-sm")}>{event.title}</p>
                      <p className={cn("text-ui-muted", isWallMode ? "text-sm" : "text-xs")}>
                        {event.isAllDay ? 'All day' : format(new Date(event.startTime), 'h:mm a')}
                        {eventWeather ? ` · ${getWeatherInfo(eventWeather.weatherCode).icon} ${Math.round(toDisplayTemp(eventWeather.temp, tempUnit))}°` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
              {todayHomework.map(hw => (
                <div key={hw.id} className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full flex-shrink-0 bg-amber-400" />
                  <div className="min-w-0">
                    <p className={cn("font-medium truncate", isWallMode ? "text-base" : "text-sm")}>📚 {hw.title}</p>
                    <p className={cn("text-ui-muted", isWallMode ? "text-sm" : "text-xs")}>{hw.subject} · {hw.dueDate === today ? 'Due today' : 'Overdue'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Auto-rotating carousel when enabled */}
      {rotationEnabled && isWallMode && (() => {
        const validSlides = (rotationOrder as Array<'chores' | 'calendar' | 'weather' | 'photos'>).filter(s =>
          (s === 'chores' && kids.length > 0) ||
          (s === 'calendar' && (todayEvents.length > 0 || todayHomework.length > 0)) ||
          (s === 'weather' && forecast.length > 0) ||
          s === 'photos'
        );
        if (validSlides.length === 0) return null;
        return (
          <DisplayCarousel slides={validSlides} intervalSec={rotationInterval}>
            {{
              chores: kids.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 border border-ui">
                    <h2 className="text-base font-semibold text-ui-muted uppercase tracking-wide mb-3">Chores Today</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {kidProgress.map(({ kid, total, done }) => {
                        const pct = total === 0 ? 100 : Math.round((done / total) * 100);
                        const color = memberColorMap[kid.uid] || '#6366f1';
                        const allDone = total > 0 && done >= total;
                        return (
                          <div key={kid.uid} className={cn("rounded-xl p-4 border", allDone ? "bg-emerald-50 border-emerald-200" : "border-ui bg-ui-soft")}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-base font-semibold truncate">{kid.name}</span>
                              {allDone && <span className="ml-auto text-emerald-500 text-sm font-bold">✓</span>}
                            </div>
                            <div className="w-full bg-ui-soft-3 rounded-full h-2.5 mb-1">
                              <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: allDone ? '#10b981' : color }} />
                            </div>
                            <p className="text-sm text-ui-muted">{done}/{total} done</p>
                          </div>
                        );
                      })}
                    </div>
                    {allTasks.length > 0 && (
                      <div className="mt-4">
                        <WeeklyChoreGrid tasks={allTasks} kids={kids} completions={allCompletions} />
                      </div>
                    )}
                  </div>
                </div>
              ) : undefined,
              calendar: (
                <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 border border-ui">
                  <h2 className="text-base font-semibold text-ui-muted uppercase tracking-wide mb-3">Today</h2>
                  <div className="space-y-2">
                    {todayEvents.map(event => (
                      <div key={event.id} className="flex items-center gap-3">
                        <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: event.color || '#6366f1' }} />
                        <div>
                          <p className="text-base font-medium">{event.title}</p>
                          <p className="text-sm text-ui-muted">
                            {event.isAllDay ? 'All day' : format(new Date(event.startTime), 'h:mm a')}
                            {(() => {
                              const wx = getEventWeather(event);
                              return wx ? ` · ${getWeatherInfo(wx.weatherCode).icon} ${Math.round(toDisplayTemp(wx.temp, tempUnit))}°` : '';
                            })()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {todayHomework.map(hw => (
                      <div key={hw.id} className="flex items-center gap-3">
                        <div className="w-1.5 h-10 rounded-full flex-shrink-0 bg-amber-400" />
                        <div>
                          <p className="text-base font-medium">📚 {hw.title}</p>
                          <p className="text-sm text-ui-muted">{hw.subject}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
              weather: forecast.length > 0 ? (
                <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 border border-ui">
                  <h2 className="text-base font-semibold text-ui-muted uppercase tracking-wide mb-3">Forecast</h2>
                  <WeeklyWeather forecast={forecast} temperatureUnit={tempUnit} />
                </div>
              ) : undefined,
            }}
          </DisplayCarousel>
        );
      })()}

      {/* Family task progress — hidden when carousel is active */}
      {(!rotationEnabled || !isWallMode) && kids.length > 0 && (
        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
          <h2 className={cn("font-semibold text-ui-muted uppercase tracking-wide mb-3", isWallMode ? "text-base" : "text-sm")}>Chores Today</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kidProgress.map(({ kid, total, done }) => {
              const pct = total === 0 ? 100 : Math.round((done / total) * 100);
              const color = memberColorMap[kid.uid] || '#6366f1';
              const allDone = total > 0 && done >= total;
              return (
                <div key={kid.uid} className={cn(
                  "rounded-xl border transition-colors",
                  isWallMode ? "p-4" : "p-3",
                  allDone ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700" : "border-ui bg-ui-soft"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className={cn("font-semibold truncate", isWallMode ? "text-base" : "text-sm")}>{kid.name}</span>
                    {allDone && <span className={cn("ml-auto text-emerald-500 font-bold", isWallMode ? "text-sm" : "text-xs")}>✓</span>}
                  </div>
                  <div className={cn("w-full bg-ui-soft-3 rounded-full mb-1", isWallMode ? "h-2.5" : "h-1.5")}>
                    <div
                      className={cn("rounded-full transition-all duration-500", isWallMode ? "h-2.5" : "h-1.5")}
                      style={{ width: `${pct}%`, backgroundColor: allDone ? '#10b981' : color }}
                    />
                  </div>
                  <p className={cn("text-ui-muted", isWallMode ? "text-sm" : "text-xs")}>{done}/{total} done</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly chore grid — hidden when carousel is active */}
      {(!rotationEnabled || !isWallMode) && kids.length > 0 && allTasks.length > 0 && (
        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
          <h2 className={cn("font-semibold text-ui-muted uppercase tracking-wide mb-3", isWallMode ? "text-base" : "text-sm")}>This Week</h2>
          <WeeklyChoreGrid tasks={allTasks} kids={kids} completions={allCompletions} compact={!isWallMode} />
        </div>
      )}

      {/* Bottom strip: weather forecast + family note — hidden when carousel is active */}
      {(!rotationEnabled || !isWallMode) && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forecast.length > 0 && (
          <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
            <h2 className={cn("font-semibold text-ui-muted uppercase tracking-wide mb-3", isWallMode ? "text-base" : "text-sm")}>Forecast</h2>
            <WeeklyWeather forecast={forecast} temperatureUnit={tempUnit} />
          </div>
        )}
        <div className="bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui">
          <h2 className={cn("font-semibold text-ui-muted uppercase tracking-wide mb-3", isWallMode ? "text-base" : "text-sm")}>Family Note</h2>
          <FamilyNote parentId={parentId} readOnly={isLocked} />
        </div>
      </div>}

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
