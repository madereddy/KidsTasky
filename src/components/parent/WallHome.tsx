import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { MonitorSmartphone, Maximize2, LogOut } from 'lucide-react';
import { CalendarEvent, Homework, UserProfile } from '../../types';
import { HourlyForecastEntry } from '../../services/weather';
import { FamilyNote } from '../shared/FamilyNote';
import { WeeklyWeather } from '../calendar/WeeklyWeather';
import { WeeklyChoreGrid } from '../shared/WeeklyChoreGrid';
import { DisplayCarousel } from '../shared/DisplayCarousel';
import { getWeatherInfo } from '../../constants';
import { getEffectiveEventEndTime, isEventCurrentOrUpcoming, toDisplayTemp } from '../../lib/dateTimePrefs';
import { useSocketStaleData } from '../../hooks/useSocket';
import { useDisplayMode } from '../../contexts/DisplayContext';
import { cn } from '../../lib/utils';
import { useWallHomeController } from '../../hooks/useWallHomeController';
import { useWakeLock } from '../../hooks/useWakeLock';
import { WallSkeleton } from '../shared/Skeleton';
import { IntelligenceHeader } from '../shared/IntelligenceHeader';
import { FrequentItemChips } from '../shared/FrequentItemChips';
import { listsClientService } from '../../services/lists';
import { XpCelebration } from './XpCelebration';
import { FamilyLeaderboard } from './FamilyLeaderboard';
import { AnimatePresence } from 'motion/react';
import { WallWakeOverlay } from './WallWakeOverlay';
import { clientLogger } from '../../services/clientLogger';

interface Props {
  parentId: string;
  profile: UserProfile;
  kids: UserProfile[];
  memberColorMap: Record<string, string>;
  isLocked: boolean;
  onManage: () => void;
  settings?: any;
  justWoke?: number;
  onToggleWall?: () => void;
  onToggleKiosk?: () => void;
  onExitKiosk?: () => void;
}

// Original clock used in non-wall mode
function LiveClock({ use24h = false }: { use24h?: boolean }) {
  const [now, setNow] = useState(new Date());
  const { isWallMode } = useDisplayMode();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center" data-testid="wall-clock">
      <div className={cn("font-bold tabular-nums", isWallMode ? "text-7xl" : "text-4xl")}>
        {format(now, use24h ? 'H:mm' : 'h:mm')}
        {!use24h && <span className={cn("ml-1", isWallMode ? "text-4xl" : "text-2xl")}>{format(now, 'a')}</span>}
      </div>
      <div className={cn("text-ui-muted mt-1", isWallMode ? "text-base" : "text-sm")}>{format(now, 'EEEE, MMMM d')}</div>
    </div>
  );
}

// Skylight-style clock for wall mode — oversized, left-aligned
function SkyLiveClock({ use24h = false }: { use24h?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div data-testid="wall-clock">
      <div className="text-7xl font-black tabular-nums leading-none text-ui-primary">
        {format(now, use24h ? 'H:mm' : 'h:mm')}
        {!use24h && <span className="text-3xl font-semibold ml-2 text-ui-muted-2">{format(now, 'a')}</span>}
      </div>
      <div className="mt-2 text-xs font-bold text-ui-muted-2 uppercase tracking-[0.15em]">
        {format(now, 'EEEE')}
      </div>
      <div className="text-base font-semibold text-ui-secondary mt-0.5">
        {format(now, 'MMMM d, yyyy')}
      </div>
    </div>
  );
}

interface KidProgress {
  kid: UserProfile;
  total: number;
  done: number;
}

export function WallHome({ parentId, profile, kids, memberColorMap, isLocked, onManage, settings, justWoke = 0, onToggleWall, onToggleKiosk, onExitKiosk }: Props) {
  const [expandedKidId, setExpandedKidId] = useState<string | null>(null);
  const [showWakeOverlay, setShowWakeOverlay] = useState(false);
  useEffect(() => {
    if (justWoke <= 0) return;

    setShowWakeOverlay(true);
    const t = setTimeout(() => setShowWakeOverlay(false), 5000);
    return () => clearTimeout(t);
  }, [justWoke]);

  const { isWallMode, isKioskMode } = useDisplayMode();
  useWakeLock(isWallMode);
  const {
    today,
    events,
    tasksByKid,
    completionsByKid,
    homework,
    forecast,
    hourlyToday,
    tempUnit,
    timeFormat,
    rotationEnabled,
    rotationInterval,
    rotationOrder,
    loading,
    loadError,
    fetchFamilyData,
    fetchKidTaskData,
    allTasks,
    allCompletions,
    intelligence,
    lists,
    listItems,
    frequentItems,
    wallMode,
    leaderboard,
    powerMission,
    celebration,
  } = useWallHomeController({ parentId, kids, initialSettings: settings });

  useSocketStaleData(['events', 'homework', 'tasks', 'completions', 'weather', 'settings'], useCallback((data: { entity?: string; type?: string }) => {
    const signal = data.type || data.entity;
    if (signal === 'tasks' || signal === 'completions') {
      void fetchKidTaskData();
      return;
    }
    fetchFamilyData();
  }, [fetchFamilyData, fetchKidTaskData]));

  const todayEvents = events
    .filter(e => {
      const start = new Date(e.startTime);
      const isToday = format(start, 'yyyy-MM-dd') === today;
      if (!isToday) return false;
      return isEventCurrentOrUpcoming(e);
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

  const handleAddIngredients = useCallback(async () => {
    if (!intelligence.meal?.ingredients?.length) return;
    
    // Find a shopping list or use the first one available
    let shoppingList = lists.find(l => l.category === 'shopping');
    
    if (!shoppingList && lists.length > 0) {
      shoppingList = lists[0];
    }
    
    if (!shoppingList) {
      try {
        shoppingList = await listsClientService.createList('Shopping List', 'shopping');
      } catch (err) {
        clientLogger.error('Failed to create shopping list', { error: err instanceof Error ? err.message : String(err) });
        return;
      }
    }

    if (!shoppingList) return;

    try {
      // Find items already on this list to avoid duplicates
      const existingItems = new Set(
        listItems
          .filter(item => item.listId === shoppingList!.id && item.completed === 0)
          .map(item => item.text.toLowerCase().trim())
      );

      let addedCount = 0;
      // Add each ingredient as a list item if not already present
      for (const ingredient of intelligence.meal.ingredients) {
        if (!existingItems.has(ingredient.toLowerCase().trim())) {
          await listsClientService.addItem(shoppingList.id, ingredient);
          addedCount++;
        }
      }

      // Trigger a refresh of family data to update lists/items
      void fetchFamilyData();
      
      if (addedCount > 0) {
        alert(`Added ${addedCount} new items to ${shoppingList.title}`);
      } else {
        alert('All ingredients are already on your shopping list!');
      }
    } catch (err) {
      clientLogger.error('Failed to add ingredients', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [intelligence.meal, lists, listItems, fetchFamilyData]);

  const handleQuickAdd = useCallback(async (text: string) => {
    let shoppingList = lists.find(l => l.category === 'shopping');
    if (!shoppingList && lists.length > 0) shoppingList = lists[0];
    
    if (!shoppingList) {
      try {
        shoppingList = await listsClientService.createList('Shopping List', 'shopping');
      } catch (err) {
        clientLogger.error('Failed to create shopping list', { error: err instanceof Error ? err.message : String(err) });
        return;
      }
    }

    if (!shoppingList) return;

    try {
      await listsClientService.addItem(shoppingList.id, text);
      void fetchFamilyData();
    } catch (err) {
      clientLogger.error('Failed to add item', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [lists, fetchFamilyData]);

  if (loading) {
    return <WallSkeleton />;
  }

  // ── SKYLIGHT-INSPIRED WALL MODE ──────────────────────────────────────────
  if (isWallMode) {
    const nowMs = Date.now();
    const nowDate = new Date();

    // Build day groups: today through +4 days
    type DayItem =
      | { type: 'event'; data: CalendarEvent }
      | { type: 'hw'; data: Homework };

    const dayGroups: Array<{ label: string; items: DayItem[] }> = [];

    for (let d = 0; d <= 4; d++) {
      const dt = new Date(nowDate);
      dt.setDate(dt.getDate() + d);
      const dateStr = format(dt, 'yyyy-MM-dd');

      const dayEvts = events
        .filter(e => {
          const evDate = format(new Date(e.startTime), 'yyyy-MM-dd');
          return evDate === dateStr && (d === 0 ? getEffectiveEventEndTime(e) > nowMs : true);
        })
        .sort((a, b) => a.startTime - b.startTime);

      const dayHw = homework.filter(h => h.status === 'pending' && h.dueDate === dateStr);

      const items: DayItem[] = [
        ...dayEvts.map(e => ({ type: 'event' as const, data: e })),
        ...dayHw.map(h => ({ type: 'hw' as const, data: h })),
      ];

      if (items.length > 0 || d < 2) {
        const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : format(dt, 'EEE, MMM d');
        dayGroups.push({ label, items });
      }
    }

    return (
      <div className="flex overflow-hidden" style={{ minHeight: '100vh', background: '#ffffff', color: '#0f172a' }}>
        <XpCelebration
          payload={celebration}
          kidName={kids.find(k => k.uid === celebration?.userId)?.name ?? ''}
        />

        {/* ── LEFT PANEL: Clock · Weather · Chores ── */}
        <aside className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-ui-soft bg-white">

          {/* Clock + date */}
          <div className="px-8 pt-8 pb-6">
            <SkyLiveClock use24h={timeFormat === '24h'} />
          </div>

          {/* Weather */}
          {todayWeather && (
            <>
              <div className="mx-8 h-px bg-ui-soft" />
              <div className="px-8 py-5 flex items-center gap-3">
                <span className="text-4xl">{getWeatherInfo(todayWeather.weatherCode).icon}</span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-orange-500">
                      {Math.round(toDisplayTemp(todayWeather.maxTemp, tempUnit))}°
                    </span>
                    <span className="text-xl font-semibold text-blue-400">
                      {Math.round(toDisplayTemp(todayWeather.minTemp, tempUnit))}°
                    </span>
                  </div>
                  <p className="text-sm text-ui-muted mt-0.5">
                    {getWeatherInfo(todayWeather.weatherCode).label}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Chores */}
          {kids.length > 0 && (
            <>
              <div className="mx-8 h-px bg-ui-soft" />
              <div className="px-6 py-5 flex-1 min-h-0 overflow-y-auto">
                <p className="text-xs font-bold text-ui-muted-2 uppercase tracking-[0.15em] mb-4">
                  Chores
                </p>
                <div className="space-y-3">
                  {kids.map((kid) => {
                    const tasks = (tasksByKid[kid.uid] || []).filter(t => t.status !== 'archived');
                    const comps = completionsByKid[kid.uid] || [];
                    const completedIds = new Set(comps.map(c => c.taskId));
                    const done = tasks.filter(t => completedIds.has(t.id)).length;
                    const total = tasks.length;
                    const allDone = total > 0 && done >= total;
                    const remaining = total - done;
                    const color = memberColorMap[kid.uid] || '#6366f1';
                    const isExpanded = expandedKidId === kid.uid;

                    return (
                      <div
                        key={kid.uid}
                        data-testid={`kid-card-${kid.uid}`}
                        className={cn(
                          'rounded-2xl border-2 cursor-pointer min-h-[64px]',
                          allDone ? 'border-emerald-500' : 'border-ui'
                        )}
                        onClick={() => setExpandedKidId(isExpanded ? null : kid.uid)}
                      >
                        {/* Card header */}
                        <div className="flex items-center gap-3 px-3 py-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {kid.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-ui-primary">{kid.name}</div>
                            <div className={cn('text-xs', allDone ? 'text-emerald-600 font-semibold' : 'text-ui-muted')}>
                              {allDone ? 'All done!' : `${done} of ${total} done`}
                            </div>
                          </div>
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                            allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {allDone ? '✓' : remaining}
                          </div>
                        </div>

                        {/* Expanded task rows */}
                        {isExpanded && tasks.length > 0 && (
                          <div className="pl-[52px] pr-3 pb-3 flex flex-col gap-1.5">
                            {tasks.map(task => {
                              const isDone = completedIds.has(task.id);
                              return (
                                <div key={task.id} className="flex items-center gap-2">
                                  <div className={cn(
                                    'w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center',
                                    isDone
                                      ? 'border-emerald-500 bg-emerald-50'
                                      : 'border-indigo-400'
                                  )}>
                                    {isDone && <span className="text-[10px] text-emerald-600">✓</span>}
                                  </div>
                                  <span className={cn(
                                    'text-xs',
                                    isDone ? 'line-through text-ui-muted-2' : 'text-ui-primary font-medium'
                                  )}>
                                    {task.title}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Manage link — hidden in kiosk mode */}
          {!isKioskMode && (
            <div className="px-8 pb-6 mt-auto pt-4">
              <button
                onClick={onManage}
                className="text-xs text-ui-muted hover:text-ui-primary transition-colors"
              >
                Manage family →
              </button>
            </div>
          )}
        </aside>

        {/* ── RIGHT PANEL: Agenda ── */}
        <main className="relative flex-1 overflow-y-auto px-8 xl:px-12 py-8 bg-white">
          <AnimatePresence>
            {showWakeOverlay && (
              <WallWakeOverlay
                onDismiss={() => setShowWakeOverlay(false)}
                intelligence={intelligence}
                powerMission={powerMission}
                frequentItems={frequentItems}
                wallMode={wallMode}
                onAddIngredients={handleAddIngredients}
                onQuickAdd={handleQuickAdd}
              />
            )}
          </AnimatePresence>

          {loadError && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-rose-700">{loadError}</p>
              <button
                onClick={() => void fetchFamilyData()}
                className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Countdown chips for events marked isCountdown */}
          {(() => {
            const nowMs = Date.now();
            const countdownEvts = events
              .filter(e => Boolean(e.isCountdown) && e.startTime > nowMs)
              .sort((a, b) => a.startTime - b.startTime)
              .slice(0, 3);
            if (countdownEvts.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-3 mb-8">
                {countdownEvts.map(e => {
                  const daysLeft = Math.ceil((e.startTime - nowMs) / (1000 * 60 * 60 * 24));
                  const color = e.color || '#6366f1';
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2" style={{ borderColor: color }}>
                      <div className="text-3xl font-black tabular-nums" style={{ color }}>{daysLeft}</div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>days</div>
                        <div className="text-sm font-semibold text-ui-primary">{e.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {dayGroups.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-lg text-ui-muted">Nothing coming up</p>
            </div>
          ) : (
            <div className="space-y-8">
              {dayGroups.map(({ label, items }) => (
                <section key={label}>
                  {/* Day header + rule */}
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-sm font-bold text-ui-secondary uppercase tracking-[0.12em] shrink-0">
                      {label}
                    </span>
                    <div className="flex-1 h-px bg-ui-soft" />
                  </div>

                  {items.length === 0 ? (
                    <p className="text-sm text-ui-muted-2 pl-2">Nothing scheduled</p>
                  ) : (
                    <div>
                      {items.map(item => {
                        if (item.type === 'event') {
                          const evt = item.data;
                          const memberColor = evt.assignedToId ? memberColorMap[evt.assignedToId] : null;
                          const evtColor = evt.color || memberColor || '#6366f1';
                          const assignedName = evt.assignedToId
                            ? kids.find(k => k.uid === evt.assignedToId)?.name ?? null
                            : null;
                          return (
                            <div key={evt.id} className="flex items-center gap-4 py-3.5 border-b border-ui-soft last:border-0">
                              <div className="w-[80px] shrink-0 text-right">
                                <span className="text-sm font-semibold text-ui-secondary tabular-nums">
                                  {evt.isAllDay ? 'All day' : format(new Date(evt.startTime), 'h:mm a')}
                                </span>
                              </div>
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: evtColor }} />
                              <p className="flex-1 text-xl font-bold text-ui-primary truncate">
                                {evt.title}
                              </p>
                              {assignedName && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: evtColor }} />
                                  <span className="text-sm text-ui-muted">{assignedName}</span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // homework item
                        const hw = item.data;
                        return (
                          <div key={hw.id} className="flex items-center gap-4 py-3.5 border-b border-ui-soft last:border-0">
                            <div className="w-[80px] shrink-0 text-right">
                              <span className="text-sm font-semibold text-amber-600 tabular-nums">Due</span>
                            </div>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xl font-bold text-ui-primary truncate">
                                📚 {hw.title}
                              </p>
                              {hw.subject && (
                                <p className="text-xs text-ui-muted">{hw.subject}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* Family Leaderboard — afterschool and evening */}
          {(wallMode === 'afterschool' || wallMode === 'evening') && leaderboard.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs font-bold text-ui-muted-2 uppercase tracking-[0.15em] mb-3">
                This Week
              </h2>
              <FamilyLeaderboard entries={leaderboard} isWallMode />
            </section>
          )}
        </main>

        {/* Exit kiosk — fixed bottom-right, only in kiosk mode */}
        {isKioskMode && onExitKiosk && (
          <button
            onClick={onExitKiosk}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-4 py-2 bg-black/60 text-white rounded-full text-xs font-bold backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            <LogOut size={12} /> Exit
          </button>
        )}
      </div>
    );
  }
  // ── END SKYLIGHT WALL MODE ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Wall / Kiosk entry buttons — only for desktop parents */}
      {(onToggleWall || onToggleKiosk) && (
        <div className="flex justify-end gap-2">
          {onToggleWall && (
            <button
              onClick={onToggleWall}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ui-soft border border-ui text-xs font-semibold text-ui-secondary hover:bg-ui-soft-3 transition-colors"
            >
              <MonitorSmartphone size={14} /> Wall Display
            </button>
          )}
          {onToggleKiosk && (
            <button
              onClick={onToggleKiosk}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ui-soft border border-ui text-xs font-semibold text-ui-secondary hover:bg-ui-soft-3 transition-colors"
            >
              <Maximize2 size={14} /> Kiosk
            </button>
          )}
        </div>
      )}
      <IntelligenceHeader data={intelligence} onAddIngredients={handleAddIngredients} />
      <div className="-mx-2">
        <FrequentItemChips items={frequentItems} onAdd={handleQuickAdd} />
      </div>
      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 flex items-center justify-between">
          <p className="text-sm text-rose-700">{loadError}</p>
          <button onClick={() => void fetchFamilyData()} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold">Retry</button>
        </div>
      )}
      {/* Top strip: clock + weather today */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="md:col-span-1 bg-white/80 dark:bg-white/5 rounded-2xl p-4 shadow-sm border border-ui flex flex-col items-center">
          <LiveClock use24h={timeFormat === '24h'} />
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
                  <div key={hour.time} className="px-2 py-1 rounded-lg bg-ui-soft-2 text-xs text-ui-secondary flex items-center gap-1.5">
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
            <div className="space-y-2 overflow-y-auto max-h-40">
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
