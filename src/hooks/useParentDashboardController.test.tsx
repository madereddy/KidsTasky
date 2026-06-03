// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParentDashboardController } from './useParentDashboardController';

vi.mock('../services/http', () => ({
  fetchAPI: vi.fn(),
}));
vi.mock('../services/users', () => ({
  userService: {
    getKidsForParent: vi.fn(),
  },
}));
vi.mock('../services/invites', () => ({
  inviteService: {
    getActiveInvite: vi.fn(),
    createInvite: vi.fn(),
  },
}));
vi.mock('../services/notifications', () => ({
  notificationService: {
    getUnreadNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
  },
}));
vi.mock('../services/rewards', () => ({
  rewardService: {
    getRewards: vi.fn(),
  },
}));
vi.mock('../services/sync', () => ({
  syncClientService: {
    getCalendars: vi.fn(),
    toggleCalendar: vi.fn(),
  },
}));
vi.mock('../services/tasks', () => ({
  tasksClientService: {
    getPendingCompletions: vi.fn(),
    getTasksForParent: vi.fn(),
  },
}));
vi.mock('../services/homework', () => ({
  homeworkClientService: {
    getHomework: vi.fn(),
  },
}));
vi.mock('../services/events', () => ({
  eventsClientService: {
    getEvents: vi.fn(),
  },
}));

import { fetchAPI } from '../services/http';
import { userService } from '../services/users';
import { inviteService } from '../services/invites';
import { notificationService } from '../services/notifications';
import { rewardService } from '../services/rewards';
import { syncClientService } from '../services/sync';
import { tasksClientService } from '../services/tasks';
import { homeworkClientService } from '../services/homework';
import { eventsClientService } from '../services/events';

describe('useParentDashboardController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userService.getKidsForParent).mockResolvedValue([{ uid: 'k1', role: 'kid', name: 'Kid One', email: 'kid@test.com' }] as any);
    vi.mocked(inviteService.getActiveInvite).mockResolvedValue(null as any);
    vi.mocked(notificationService.getUnreadNotifications).mockResolvedValue([{ id: 'n1', taskId: 't1', taskTitle: 'Brush Teeth', kidId: 'k1', kidName: 'Kid One', parentId: 'p1', type: 'overdue', status: 'unread', createdAt: 1, dateString: '2026-06-03' }] as any);
    vi.mocked(rewardService.getRewards).mockResolvedValue([{ id: 'r1', parentId: 'p1', title: 'Reward', xpCost: 50 }] as any);
    vi.mocked(fetchAPI).mockResolvedValue([] as any);
    vi.mocked(syncClientService.getCalendars).mockResolvedValue([{ id: 'cal1', enabled: true }] as any);
    vi.mocked(eventsClientService.getEvents).mockResolvedValue([{ id: 'e1', startTime: Date.now() + 1000 }] as any);
    vi.mocked(homeworkClientService.getHomework).mockResolvedValue([{ id: 'h1', dueDate: new Date().toISOString().slice(0, 10), status: 'pending' }] as any);
    vi.mocked(tasksClientService.getPendingCompletions).mockResolvedValue([{ id: 'pc1' }] as any);
    vi.mocked(tasksClientService.getTasksForParent).mockResolvedValue([{ id: 't1', status: 'active' }] as any);
  });

  it('loads aggregate dashboard state and summary', async () => {
    const { result } = renderHook(() => useParentDashboardController({ familyId: 'p1' }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.kids).toHaveLength(1);
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.todaySummary).toMatchObject({
      eventsToday: 1,
      homeworkDue: 1,
      pendingApprovals: 1,
      activeChores: 1,
    });
  });

  it('marks notifications read locally after the API call', async () => {
    const { result } = renderHook(() => useParentDashboardController({ familyId: 'p1' }));
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.markRead('n1');
    });

    expect(notificationService.markNotificationRead).toHaveBeenCalledWith('n1');
    expect(result.current.notifications).toHaveLength(0);
  });
});
