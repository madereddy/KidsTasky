// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KidDashboard } from './KidDashboard';

vi.mock('../../services/users', () => ({
  userService: {
    addBadge: vi.fn(),
    updateUserXP: vi.fn(),
    updateUserTheme: vi.fn(),
  },
}));

vi.mock('../../services/tasks', () => ({
  tasksClientService: {
    getTasksForKid: vi.fn().mockResolvedValue([]),
    getCompletionsForKid: vi.fn().mockResolvedValue([]),
    getCompletionsForDateRange: vi.fn().mockResolvedValue([]),
    completeTask: vi.fn(),
    uncompleteTask: vi.fn(),
    skipTask: vi.fn(),
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

vi.mock('./KidTaskBoard', () => ({
  KidTaskBoard: () => <div data-testid="kid-task-board">tasks-view</div>,
}));

vi.mock('../calendar/CalendarView', () => ({
  CalendarView: (props: any) => (
    <div data-testid="kid-calendar-view">
      {props.isLocked ? 'locked' : 'unlocked'}
    </div>
  ),
}));

vi.mock('../homework/HomeworkView', () => ({
  HomeworkView: () => <div data-testid="kid-homework-view">homework-view</div>,
}));

vi.mock('../shared/FamilyNote', () => ({
  FamilyNote: () => <div />,
}));

vi.mock('../shared/AvatarPicker', () => ({
  AvatarDisplay: () => <div />,
  AvatarPicker: () => <div />,
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
};

describe('KidDashboard tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches Tasks -> Calendar -> Homework views and keeps calendar locked', async () => {
    render(
      <KidDashboard
        profile={profile}
        onProgressChange={() => {}}
        categories={[]}
        selectedCategoryId={null}
        onProfileUpdate={() => {}}
        kids={[]}
        memberColorMap={{}}
      />
    );

    expect(await screen.findByTestId('kid-task-board')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    expect(await screen.findByTestId('kid-calendar-view')).toHaveTextContent('locked');

    fireEvent.click(screen.getByRole('button', { name: /Homework/i }));
    expect(await screen.findByTestId('kid-homework-view')).toBeInTheDocument();
  });
});
