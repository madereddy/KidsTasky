import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, Homework, Task, TaskCompletion, UserProfile } from '../types';
import { dashboardClientService } from '../services/dashboard';
import { weatherClientService, DailyForecast, HourlyForecastEntry } from '../services/weather';
import { settingsClientService } from '../services/settings';

interface UseWallHomeControllerOptions {
  parentId: string;
  kids: UserProfile[];
  initialSettings?: any;
}

export function useWallHomeController({ parentId, kids, initialSettings }: UseWallHomeControllerOptions) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasksByKid, setTasksByKid] = useState<Record<string, Task[]>>({});
  const [completionsByKid, setCompletionsByKid] = useState<Record<string, TaskCompletion[]>>({});
  const [homework, setHomework] = useState<Homework[]>([]);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [hourlyToday, setHourlyToday] = useState<HourlyForecastEntry[]>([]);
  const [tempUnit, setTempUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [rotationInterval, setRotationInterval] = useState(30);
  const [rotationOrder, setRotationOrder] = useState<string[]>(['chores', 'calendar', 'weather']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');
  const memoKids = useMemo(() => JSON.stringify(kids), [kids]);

  const fetchFamilyData = useCallback(async () => {
    try {
      setLoadError('');
      
      const settings = initialSettings || await settingsClientService.getSettings(parentId).catch(() => null);
      
      if (settings?.temperatureUnit) setTempUnit(settings.temperatureUnit);
      if (settings?.displayRotationEnabled !== undefined) setRotationEnabled(Boolean(settings.displayRotationEnabled));
      if (settings?.displayRotationInterval) setRotationInterval(settings.displayRotationInterval);
      if (settings?.displayRotationOrder) {
        try { setRotationOrder(JSON.parse(settings.displayRotationOrder)); } catch {}
      }

      const weatherPromise = (settings?.locationLat && settings?.locationLon)
        ? weatherClientService.getForecastWithHourly(settings.locationLat, settings.locationLon).catch(() => null)
        : Promise.resolve(null);

      const dashboardPromise = dashboardClientService.getFamilyDashboardData(parentId, today);

      const [wx, dashboardData] = await Promise.all([weatherPromise, dashboardPromise]);

      setEvents(dashboardData.events);
      setHomework(dashboardData.homework);
      
      // Map tasks and completions by kid
      const tMap: Record<string, Task[]> = {};
      const cMap: Record<string, TaskCompletion[]> = {};
      
      const parsedKids = JSON.parse(memoKids);
      // Initialize maps for all kids
      parsedKids.forEach((k: any) => {
        tMap[k.uid] = [];
        cMap[k.uid] = [];
      });

      dashboardData.tasks.forEach(t => {
        if (t.assignedKidId === 'all') {
          parsedKids.forEach((k: any) => {
            if (!tMap[k.uid]) tMap[k.uid] = [];
            tMap[k.uid].push(t);
          });
        } else if (tMap[t.assignedKidId]) {
          tMap[t.assignedKidId].push(t);
        }
      });

      dashboardData.completions.forEach(c => {
        if (cMap[c.kidId]) {
          cMap[c.kidId].push(c);
        }
      });

      setTasksByKid(tMap);
      setCompletionsByKid(cMap);

      if (wx) {
        setForecast(wx.daily || []);
        setHourlyToday(wx.hourlyToday || []);
      }
    } catch (error) {
      console.error('[WallHome] fetchFamilyData error', error);
      setLoadError('Could not load home data.');
    } finally {
      setLoading(false);
    }
  }, [parentId, memoKids, today, initialSettings]);

  useEffect(() => {
    void fetchFamilyData();
  }, [fetchFamilyData]);

  const allTasks = useMemo(() => Object.values(tasksByKid).flat(), [tasksByKid]);
  const allCompletions = useMemo(() => Object.values(completionsByKid).flat(), [completionsByKid]);

  return {
    today,
    events,
    tasksByKid,
    completionsByKid,
    homework,
    forecast,
    hourlyToday,
    tempUnit,
    rotationEnabled,
    rotationInterval,
    rotationOrder,
    loading,
    loadError,
    fetchFamilyData,
    fetchKidTaskData: fetchFamilyData, // Alias for backward compatibility in WallHome
    allTasks,
    allCompletions,
  };
}
