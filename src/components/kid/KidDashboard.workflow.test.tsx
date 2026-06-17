// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KidDashboard } from './KidDashboard';
import { buildTaskCompletionId } from '../../lib/completion-state';
import { TaskCompletion } from '../../types';

const getTasksForKid = vi.fn();
const getCompletionsForKid = vi.fn();
const getCompletionsForDateRange = vi.fn();
const completeTask = vi.fn();
const uncompleteTask = vi.fn();
const skipTask = vi.fn();

vi.mock('../../services/users', () => ({
  userService: {
    addBadge: vi.fn(),
    updateUserXP: vi.fn(),
    updateUserTheme: vi.fn(),
  },
}));

vi.mock('../../services/tasks', () => ({
  tasksClientService: {
    getTasksForKid: (...args: any[]) => getTasksForKid(...args),
    getCompletionsForKid: (...args: any[]) => getCompletionsForKid(...args),
    getCompletionsForDateRange: (...args: any[]) => getCompletionsForDateRange(...args),
    completeTask: (...args: any[]) => completeTask(...args),
    uncompleteTask: (...args: any[]) => uncompleteTask(...args),
    skipTask: (...args: any[]) => skipTask(...args),
  },
}));

vi.mock('../../services/rewards', () => ({
  rewardService: {
    getRewards: vi.fn().mockResolvedValue([]),
    getClaimedRewards: vi.fn().mockResolvedValue([]),
    claimReward: vi.fn(),
  },
}));

vi.mock('../../hooks/useSocket', () => ({
  useSocketStaleData: vi.fn(),
}));

vi.mock('../calendar/CalendarView', () => ({
  CalendarView: () => <div data-testid="kid-calendar-view" />,
}));

vi.mock('../homework/HomeworkView', () => ({
  HomeworkView: () => <div data-testid="kid-homework-view" />,
}));

vi.mock('../shared/FamilyNote', () => ({
  FamilyNote: () => <div />,
}));

vi.mock('../shared/AvatarPicker', () => ({
  AvatarDisplay: () => <div />,
  AvatarPicker: () => <div />,
}));

vi.mock('../shared/WeeklyChoreGrid', () => ({
  WeeklyChoreGrid: () => <div data-testid="weekly-grid" />,
}));

vi.mock('./RewardsShop', () => ({
  RewardsShop: () => <div />,
}));

const profile: any = {
  uid: 'k1',
  role: 'kid',
  name: 'Kid One',
  email: 'kid@test.com',
  parentId: 'p1',
  xp: 0,
  level: 1,
  badges: [],
  themeId: 'light_blue',
  earnedStars: 0,
  spentStars: 0,
};

describe('KidDashboard completion workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  it('persists complete -> refresh -> undo -> refresh for a kid task', async () => {
    const today = new Date().toISOString().slice(0, 10);
    let completions: TaskCompletion[] = [];
    const task = {
      id: 't1',
      title: 'Brush Teeth',
      frequency: 'daily',
      assignedKidId: 'k1',
      parentId: 'p1',
      difficulty: 'easy',
      status: 'active',
      createdAt: Date.now(),
      starValue: 1,
    };

    getTasksForKid.mockResolvedValue([task]);
    getCompletionsForKid.mockImplementation(async () => completions);
    getCompletionsForDateRange.mockResolvedValue([]);
    skipTask.mockResolvedValue(undefined);
    completeTask.mockImplementation(async (taskId: string, kidId: string, dateString: string, count?: number) => {
      completions = [
        ...completions,
        {
          id: buildTaskCompletionId(taskId, dateString, count),
          taskId,
          kidId,
          dateString,
          count,
          completedAt: { seconds: Date.now() / 1000 },
          approvalStatus: 'approved',
        },
      ];
      return { id: buildTaskCompletionId(taskId, dateString, count), approvalStatus: 'approved', created: true };
    });
    uncompleteTask.mockImplementation(async (taskId: string, dateString: string, count?: number) => {
      completions = completions.filter(
        (completion) => !(completion.taskId === taskId && completion.dateString === dateString && (completion.count ?? 1) === (count ?? 1)),
      );
    });

    const renderDashboard = () =>
      render(
        <KidDashboard
          profile={profile}
          onProgressChange={() => {}}
          categories={[]}
          selectedCategoryId={null}
          onProfileUpdate={() => {}}
          kids={[profile]}
          memberColorMap={{}}
        />,
      );

    const firstRender = renderDashboard();
    expect(await screen.findByText('Brush Teeth')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mark Done/i }));
    expect(await screen.findByRole('button', { name: /^Undo$/i })).toBeInTheDocument();

    firstRender.unmount();

    const secondRender = renderDashboard();
    expect(await screen.findByRole('button', { name: /^Undo$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Undo$/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark Done/i })).toBeInTheDocument());

    secondRender.unmount();

    renderDashboard();
    expect(await screen.findByRole('button', { name: /Mark Done/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Undo$/i })).not.toBeInTheDocument();
  });
});
