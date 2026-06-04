import { useCallback, useEffect, useState } from 'react';
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

interface UseParentDashboardControllerOptions {
  familyId: string;
}

export function useParentDashboardController({ familyId }: UseParentDashboardControllerOptions) {
  const [kids, setKids] = useState<UserProfile[]>([]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [syncCalendars, setSyncCalendars] = useState<SyncCalendar[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [todaySummary, setTodaySummary] = useState({ eventsToday: 0, homeworkDue: 0, pendingApprovals: 0, activeChores: 0 });

  const refreshTodaySummary = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [dashData, pending] = await Promise.all([
      dashboardClientService.getFamilyDashboardData(familyId, today).catch(() => null),
      tasksClientService.getPendingCompletions(familyId).catch(() => []),
    ]);
    if (dashData) {
      setTodaySummary({
        eventsToday: dashData.events.filter((e) => new Date(e.startTime).toISOString().slice(0, 10) === today).length,
        homeworkDue: dashData.homework.filter((h) => h.status !== 'done' && h.dueDate <= today).length,
        pendingApprovals: (pending || []).length,
        activeChores: dashData.tasks.filter((t) => t.status === 'active').length,
      });
    }
  }, [familyId]);

  const fetchData = useCallback(async () => {
    try {
      const [k, i, n, r, c, sc] = await Promise.all([
        userService.getKidsForParent(familyId),
        inviteService.getActiveInvite(familyId),
        notificationService.getUnreadNotifications(familyId),
        rewardService.getRewards(familyId),
        fetchAPI('/settings/' + familyId + '/connections').catch(() => []),
        syncClientService.getCalendars(familyId).catch(() => []),
      ]);
      setKids(k || []);
      setInvite(i || null);
      setNotifications(n || []);
      setRewards(r || []);
      setConnections(c || []);
      setSyncCalendars(sc || []);
      await refreshTodaySummary();
    } finally {
      setLoading(false);
    }
  }, [familyId, refreshTodaySummary]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const refreshNotifications = useCallback(async () => {
    const n = await notificationService.getUnreadNotifications(familyId);
    setNotifications(n || []);
  }, [familyId]);

  const refreshKids = useCallback(async () => {
    const k = await userService.getKidsForParent(familyId);
    setKids(k || []);
  }, [familyId]);

  const refreshConnectionsAndCalendars = useCallback(async () => {
    const [c, sc] = await Promise.all([
      fetchAPI('/settings/' + familyId + '/connections').catch(() => []),
      syncClientService.getCalendars(familyId).catch(() => []),
    ]);
    setConnections(c || []);
    setSyncCalendars(sc || []);
  }, [familyId]);

  const markRead = async (id: string) => {
    await notificationService.markNotificationRead(id);
    setNotifications((prev) => removeEntityById(prev, id));
  };

  const generateInvite = async (parentName: string) => {
    setGeneratingInvite(true);
    await inviteService.createInvite(familyId, parentName);
    const updatedInvite = await inviteService.getActiveInvite(familyId);
    setInvite(updatedInvite);
    setGeneratingInvite(false);
  };

  const refreshRewards = async () => {
    const r = await rewardService.getRewards(familyId);
    setRewards(r || []);
  };

  const handleDisconnect = async (connId: string) => {
    await fetchAPI('/settings/connections/' + connId, { method: 'DELETE' });
    setConnections((prev) => prev.filter((connection) => connection.id !== connId));
  };

  const handleToggleCalendar = async (calendarId: string, enabled: boolean) => {
    const previous = syncCalendars;
    setSyncCalendars((calendars) =>
      calendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, enabled } : calendar,
      ),
    );
    try {
      await syncClientService.toggleCalendar(calendarId, enabled);
    } catch (error) {
      setSyncCalendars(previous);
      throw error;
    }
  };

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
