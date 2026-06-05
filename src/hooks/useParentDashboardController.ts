import { useCallback, useState } from 'react';
import { fetchAPI } from '../services/http';
import { userService } from '../services/users';
import { inviteService } from '../services/invites';
import { notificationService } from '../services/notifications';
import { rewardService } from '../services/rewards';
import { syncClientService } from '../services/sync';
import { tasksClientService } from '../services/tasks';
import { dashboardClientService } from '../services/dashboard';
import { Invite, Notification, Reward, SyncCalendar, UserProfile } from '../types';
import { removeEntityById } from '../lib/entity-list';
import { useAsyncData } from './useAsyncData';

interface UseParentDashboardControllerOptions {
  familyId: string;
}

interface ParentDashboardData {
  kids: UserProfile[];
  invite: Invite | null;
  notifications: Notification[];
  connections: any[];
  syncCalendars: SyncCalendar[];
  rewards: Reward[];
  todaySummary: {
    eventsToday: number;
    homeworkDue: number;
    pendingApprovals: number;
    activeChores: number;
  };
}

const DEFAULT_SUMMARY = { eventsToday: 0, homeworkDue: 0, pendingApprovals: 0, activeChores: 0 };

export function useParentDashboardController({ familyId }: UseParentDashboardControllerOptions) {
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const fetchFn = useCallback(async (): Promise<ParentDashboardData> => {
    const today = new Date().toISOString().slice(0, 10);
    const [
      k, i, n, r, c, sc, dashData, pending
    ] = await Promise.all([
      userService.getKidsForParent(familyId),
      inviteService.getActiveInvite(familyId),
      notificationService.getUnreadNotifications(familyId),
      rewardService.getRewards(familyId),
      fetchAPI('/settings/' + familyId + '/connections').catch(() => []),
      syncClientService.getCalendars(familyId).catch(() => []),
      dashboardClientService.getFamilyDashboardData(familyId, today).catch(() => null),
      tasksClientService.getPendingCompletions(familyId).catch(() => []),
    ]);

    let summary = DEFAULT_SUMMARY;
    if (dashData) {
      summary = {
        eventsToday: dashData.events.filter((e) => new Date(e.startTime).toISOString().slice(0, 10) === today).length,
        homeworkDue: dashData.homework.filter((h) => h.status !== 'done' && h.dueDate <= today).length,
        pendingApprovals: (pending || []).length,
        activeChores: dashData.tasks.filter((t) => t.status === 'active').length,
      };
    }

    return {
      kids: k || [],
      invite: i || null,
      notifications: n || [],
      rewards: r || [],
      connections: c || [],
      syncCalendars: sc || [],
      todaySummary: summary,
    };
  }, [familyId]);

  const { data, loading, refresh: fetchData, setData } = useAsyncData<ParentDashboardData>(fetchFn, [fetchFn], {
    initialData: {
      kids: [],
      invite: null,
      notifications: [],
      connections: [],
      syncCalendars: [],
      rewards: [],
      todaySummary: DEFAULT_SUMMARY,
    }
  });

  const {
    kids,
    invite,
    notifications,
    connections,
    syncCalendars,
    rewards,
    todaySummary,
  } = data || {
    kids: [],
    invite: null,
    notifications: [],
    connections: [],
    syncCalendars: [],
    rewards: [],
    todaySummary: DEFAULT_SUMMARY,
  };

  const refreshTodaySummary = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [dashData, pending] = await Promise.all([
      dashboardClientService.getFamilyDashboardData(familyId, today).catch(() => null),
      tasksClientService.getPendingCompletions(familyId).catch(() => []),
    ]);
    if (dashData) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          todaySummary: {
            eventsToday: dashData.events.filter((e) => new Date(e.startTime).toISOString().slice(0, 10) === today).length,
            homeworkDue: dashData.homework.filter((h) => h.status !== 'done' && h.dueDate <= today).length,
            pendingApprovals: (pending || []).length,
            activeChores: dashData.tasks.filter((t) => t.status === 'active').length,
          }
        };
      });
    }
  }, [familyId, setData]);

  const refreshNotifications = useCallback(async () => {
    const n = await notificationService.getUnreadNotifications(familyId);
    setData((prev) => prev ? { ...prev, notifications: n || [] } : prev);
  }, [familyId, setData]);

  const refreshKids = useCallback(async () => {
    const k = await userService.getKidsForParent(familyId);
    setData((prev) => prev ? { ...prev, kids: k || [] } : prev);
  }, [familyId, setData]);

  const refreshConnectionsAndCalendars = useCallback(async () => {
    const [c, sc] = await Promise.all([
      fetchAPI('/settings/' + familyId + '/connections').catch(() => []),
      syncClientService.getCalendars(familyId).catch(() => []),
    ]);
    setData((prev) => prev ? { ...prev, connections: c || [], syncCalendars: sc || [] } : prev);
  }, [familyId, setData]);

  const markRead = async (id: string) => {
    await notificationService.markNotificationRead(id);
    setData((prev) => prev ? { ...prev, notifications: removeEntityById(prev.notifications, id) } : prev);
  };

  const generateInvite = async (parentName: string) => {
    setGeneratingInvite(true);
    await inviteService.createInvite(familyId, parentName);
    const updatedInvite = await inviteService.getActiveInvite(familyId);
    setData((prev) => prev ? { ...prev, invite: updatedInvite } : prev);
    setGeneratingInvite(false);
  };

  const refreshRewards = async () => {
    const r = await rewardService.getRewards(familyId);
    setData((prev) => prev ? { ...prev, rewards: r || [] } : prev);
  };

  const handleDisconnect = async (connId: string) => {
    await fetchAPI('/settings/connections/' + connId, { method: 'DELETE' });
    setData((prev) => prev ? { ...prev, connections: prev.connections.filter((connection) => connection.id !== connId) } : prev);
  };

  const handleToggleCalendar = async (calendarId: string, enabled: boolean) => {
    let previous: SyncCalendar[] = [];
    setData((prev) => {
      if (!prev) return prev;
      previous = prev.syncCalendars;
      return {
        ...prev,
        syncCalendars: prev.syncCalendars.map((calendar) =>
          calendar.id === calendarId ? { ...calendar, enabled } : calendar
        )
      };
    });
    try {
      await syncClientService.toggleCalendar(calendarId, enabled);
    } catch (error) {
      setData((prev) => prev ? { ...prev, syncCalendars: previous } : prev);
      throw error;
    }
  };

  const setKids = useCallback((value: React.SetStateAction<UserProfile[]>) => {
    setData((prev) => {
      if (!prev) return prev;
      const newKids = typeof value === 'function' ? (value as Function)(prev.kids) : value;
      return { ...prev, kids: newKids };
    });
  }, [setData]);

  return {
    kids,
    setKids,
    invite,
    notifications,
    loading,
    generatingInvite,
    connections,
    syncCalendars,
    rewards,
    todaySummary,
    fetchData,
    refreshNotifications,
    refreshKids,
    refreshConnectionsAndCalendars,
    refreshTodaySummary,
    markRead,
    generateInvite,
    refreshRewards,
    handleDisconnect,
    handleToggleCalendar,
  };
}
