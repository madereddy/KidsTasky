import { useState, useCallback, useRef, useEffect } from 'react';
import { eventsClientService } from '../../../services/events';
import { settingsClientService } from '../../../services/settings';
import { weatherClientService, DailyForecast } from '../../../services/weather';
import { routinesClientService } from '../../../services/routines';
import { listsClientService } from '../../../services/lists';
import { tasksClientService } from '../../../services/tasks';
import { photosClientService } from '../../../services/photos';
import { clientLogger } from '../../../services/clientLogger';
import { CalendarEvent, SyncCalendar, RoutineTemplate, AppList, AppListItem, UserProfile, Task, TaskCompletion } from '../../../types';
import { TemperatureUnitPref, TimeFormatPref } from '../../../lib/dateTimePrefs';
import { format } from 'date-fns';

export function useCalendarData(parentId: string, kids: UserProfile[], isWallMode: boolean) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [syncCalendars, setSyncCalendars] = useState<SyncCalendar[]>([]);
  const [calendarVisibility, setCalendarVisibility] = useState<Record<string, boolean>>({});
  const [timezone, setTimezone] = useState('America/Chicago');
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnitPref>('celsius');
  const [timeFormat, setTimeFormat] = useState<TimeFormatPref>('12h');
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [listsSummary, setListsSummary] = useState<Array<{ list: AppList; total: number; done: number }>>([]);
  const [wallKidProgress, setWallKidProgress] = useState<Array<{ kid: UserProfile; done: number; total: number }>>([]);
  const [wallPhotos, setWallPhotos] = useState<{ id: string; url: string; caption?: string }[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialMount = useRef(true);

  const fetchEvents = useCallback(async () => {
    try {
      const ev = await eventsClientService.getEvents(parentId);
      setEvents(ev || []);
      setLastRefreshedAt(new Date());
    } catch (err) {
      clientLogger.errorWithException('calendar_fetch_events_failed', err, { parentId });
    }
  }, [parentId]);

  const fetchWallData = useCallback(async () => {
    if (!isWallMode) return;
    
    routinesClientService.getTemplates(parentId).then(setRoutineTemplates).catch(() => {});
    
    listsClientService.getLists(parentId).then(async (lists) => {
      const topLists = (lists || []).slice(0, 2);
      const summaries = await Promise.all(topLists.map(async (list) => {
        const items = await listsClientService.getItems(list.id).catch(() => [] as AppListItem[]);
        const total = items.length;
        const done = items.filter((item) => Boolean(item.completed)).length;
        return { list, total, done };
      }));
      setListsSummary(summaries);
    }).catch(() => {});

    tasksClientService.getTasksForParent(parentId).then(async (allTasks) => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const progress = await Promise.all(kids.map(async (kid) => {
        const kidTasks = (allTasks || []).filter((t: Task) =>
          (t.assignedKidId === kid.uid || t.assignedKidId === 'all') && t.status !== 'archived'
        );
        const comps: TaskCompletion[] = await tasksClientService.getCompletionsForKid(kid.uid, todayStr).catch(() => []);
        const completedIds = new Set(comps.map((c) => c.taskId));
        return { kid, total: kidTasks.length, done: kidTasks.filter((t: Task) => completedIds.has(t.id)).length };
      }));
      setWallKidProgress(progress);
    }).catch(() => {});

    photosClientService.getPhotos(parentId).then((photos) => {
      setWallPhotos((photos || []).map((p: any) => ({ id: p.id, url: p.url, caption: p.caption })));
    }).catch(() => {});
  }, [parentId, isWallMode, kids]);

  useEffect(() => {
    const init = async () => {
      if (isInitialMount.current) {
        setLoading(true);
        isInitialMount.current = false;
      }
      
      const timer = setTimeout(() => setLoading(false), 5000);

      try {
        await Promise.allSettled([
          fetchEvents(),
          settingsClientService.getCalendars(parentId).then(setSyncCalendars),
          settingsClientService.getCalendarVisibility().then(rows => {
            const map: Record<string, boolean> = {};
            if (Array.isArray(rows)) {
              rows.forEach(r => map[r.calendarId] = Number(r.isVisible) === 1);
            }
            setCalendarVisibility(map);
          }),
          settingsClientService.getSettings(parentId).then(async (settings) => {
            if (!settings) return;
            setTimezone(settings.timezone || 'America/Chicago');
            setTemperatureUnit((settings.temperatureUnit as TemperatureUnitPref) || 'celsius');
            setTimeFormat((settings.timeFormat as TimeFormatPref) || '12h');
            if (typeof settings.locationLat === 'number' && typeof settings.locationLon === 'number') {
              const wx = await weatherClientService.getForecast(settings.locationLat, settings.locationLon);
              setForecast(wx || []);
            }
          })
        ]);
        
        if (isWallMode) {
          await fetchWallData();
        }
      } catch (err) {
        clientLogger.errorWithException('calendar_initialization_failed', err, { parentId });
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    };
    init();
  }, [parentId, fetchEvents, isWallMode, fetchWallData]);

  return {
    events,
    syncCalendars,
    calendarVisibility,
    timezone,
    temperatureUnit,
    timeFormat,
    forecast,
    routineTemplates,
    listsSummary,
    wallKidProgress,
    wallPhotos,
    lastRefreshedAt,
    loading,
    fetchEvents,
    fetchWallData,
    setRoutineTemplates,
    setListsSummary
  };
}
