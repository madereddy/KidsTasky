import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, Homework, Task, TaskCompletion, UserProfile, AppList, AppListItem, DailyIntelligence, MealPlan, Recipe, WallMode, LeaderboardEntry, PowerMission, MissionCompletedPayload } from '../types';
import { dashboardClientService } from '../services/dashboard';
import { weatherClientService, DailyForecast, HourlyForecastEntry } from '../services/weather';
import { settingsClientService } from '../services/settings';
import { mealsClientService } from '../services/meals';
import { listsClientService } from '../services/lists';
import { clientLogger } from '../services/clientLogger';
import { calculateNextUp } from '../lib/dateTimePrefs';
import { getCurrentWallMode } from '../lib/wallMode';
import { fetchAPI } from '../services/http';
import { getSocket } from './useSocket';

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
  const [lists, setLists] = useState<AppList[]>([]);
  const [listItems, setListItems] = useState<AppListItem[]>([]);
  const [frequentItems, setFrequentItems] = useState<string[]>([]);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [hourlyToday, setHourlyToday] = useState<HourlyForecastEntry[]>([]);
  const [tempUnit, setTempUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [rotationInterval, setRotationInterval] = useState(30);
  const [rotationOrder, setRotationOrder] = useState<string[]>(['chores', 'calendar', 'weather']);
  const [mealData, setMealData] = useState<DailyIntelligence['meal']>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [wallMode, setWallMode] = useState<WallMode>('ambient');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [powerMission, setPowerMission] = useState<PowerMission | null>(null);
  const [celebration, setCelebration] = useState<MissionCompletedPayload | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const kidIds = useMemo(() => kids.map(k => k.uid).join(','), [kids]);
  // Capture initialSettings once at mount — prevents dep-array instability from re-triggering fetch
  const initialSettingsRef = useRef(initialSettings);

  // Update wall mode every minute
  useEffect(() => {
    const update = () => setWallMode(getCurrentWallMode(new Date()));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchFamilyData = useCallback(async () => {
    if (!parentId) {
      setEvents([]);
      setTasksByKid({});
      setCompletionsByKid({});
      setHomework([]);
      setLists([]);
      setListItems([]);
      setFrequentItems([]);
      setForecast([]);
      setHourlyToday([]);
      setLoadError('');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError('');
      
      const settings = initialSettingsRef.current || await settingsClientService.getSettings(parentId).catch(() => null);
      
      if (settings?.temperatureUnit) setTempUnit(settings.temperatureUnit);
      if (settings?.timeFormat) setTimeFormat(settings.timeFormat);
      if (settings?.displayRotationEnabled !== undefined) setRotationEnabled(Boolean(settings.displayRotationEnabled));
      if (settings?.displayRotationInterval) setRotationInterval(settings.displayRotationInterval);
      if (settings?.displayRotationOrder) {
        try { setRotationOrder(JSON.parse(settings.displayRotationOrder)); } catch {}
      }

      const weatherPromise = (settings?.locationLat && settings?.locationLon)
        ? weatherClientService.getForecastWithHourly(settings.locationLat, settings.locationLon).catch(() => null)
        : Promise.resolve(null);

      const dashboardPromise = dashboardClientService.getFamilyDashboardData(parentId, today);
      const mealPlansPromise = mealsClientService.getMealPlans(parentId, today).catch(() => []);
      const recipesPromise = mealsClientService.getRecipes(parentId).catch(() => []);
      const frequentItemsPromise = listsClientService.getFrequentItems(parentId).catch(() => []);
      const leaderboardPromise = fetchAPI(`/parents/${parentId}/leaderboard`).catch(() => []);
      const powerMissionPromise = fetchAPI(`/parents/${parentId}/power-mission`).catch(() => null);

      const [wx, dashboardData, mealPlans, recipes, freqItems, leaderboardData, powerMissionData] = await Promise.all([
        weatherPromise,
        dashboardPromise,
        mealPlansPromise as Promise<MealPlan[]>,
        recipesPromise as Promise<Recipe[]>,
        frequentItemsPromise,
        leaderboardPromise,
        powerMissionPromise,
      ]);
      setLeaderboard(leaderboardData ?? []);
      setPowerMission(powerMissionData ?? null);

      setEvents(dashboardData.events);
      setHomework(dashboardData.homework);
      setLists(dashboardData.lists || []);
      setListItems(dashboardData.listItems || []);
      setFrequentItems(freqItems);
      
      // Process Meal Data
      const todayMealPlan = mealPlans.find((mp: MealPlan) => mp.date === today);
      let mealInfo: DailyIntelligence['meal'] = null;
      if (todayMealPlan?.recipeId) {
        const recipe = recipes.find((r: Recipe) => r.id === todayMealPlan.recipeId);
        if (recipe) {
          let ingredients: string[] = [];
          try {
            ingredients = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
          } catch {
            if (Array.isArray(recipe.ingredients)) ingredients = recipe.ingredients as unknown as string[];
          }
          mealInfo = {
            id: recipe.id,
            title: recipe.name,
            imageUrl: recipe.imageUrl || undefined,
            ingredients
          };
        }
      }
      setMealData(mealInfo);

      // Map tasks and completions by kid
      const tMap: Record<string, Task[]> = {};
      const cMap: Record<string, TaskCompletion[]> = {};
      
      // Initialize maps for all kids
      kids.forEach(k => {
        tMap[k.uid] = [];
        cMap[k.uid] = [];
      });

      dashboardData.tasks.forEach((t: Task) => {
        if (t.assignedKidId === 'all') {
          kids.forEach(k => {
            if (!tMap[k.uid]) tMap[k.uid] = [];
            tMap[k.uid].push(t);
          });
        } else if (tMap[t.assignedKidId]) {
          tMap[t.assignedKidId].push(t);
        }
      });

      dashboardData.completions.forEach((c: TaskCompletion) => {
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
      clientLogger.errorWithException('wall_home_fetch_family_data_failed', error, { parentId });
      setLoadError('Could not load home data.');
    } finally {
      setLoading(false);
    }
  }, [parentId, kidIds, today]); // initialSettings captured in ref at mount — no dep needed

  useEffect(() => {
    void fetchFamilyData();
  }, [fetchFamilyData]);

  // Listen for XP celebration events from socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (payload: MissionCompletedPayload) => {
      setCelebration(payload);
      setTimeout(() => setCelebration(null), 3000);
    };
    socket.on('mission-completed', handler);
    return () => { socket.off('mission-completed', handler); };
  }, []);

  const nextUp = useMemo(() => calculateNextUp(events, kids), [events, kids]);

  const intelligence = useMemo(() => ({
    nextUp,
    meal: mealData
  }), [nextUp, mealData]);

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
    timeFormat,
    rotationEnabled,
    rotationInterval,
    rotationOrder,
    intelligence,
    loading,
    loadError,
    fetchFamilyData,
    fetchKidTaskData: fetchFamilyData, // Alias for backward compatibility in WallHome
    allTasks,
    allCompletions,
    lists,
    listItems,
    frequentItems,
    wallMode,
    leaderboard,
    powerMission,
    celebration,
  };
}
