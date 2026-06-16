import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WallHome } from './WallHome';
import { DisplayContext } from '../../contexts/DisplayContext';
import { dashboardClientService } from '../../services/dashboard';

vi.mock('../../services/events', () => ({ eventsClientService: { getEvents: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/tasks', () => ({
  tasksClientService: {
    getTasksForKid: vi.fn().mockResolvedValue([]),
    getCompletionsForKid: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../services/homework', () => ({ homeworkClientService: { getHomework: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/dashboard', () => ({
  dashboardClientService: { getFamilyDashboardData: vi.fn().mockResolvedValue({ tasks: [], completions: [], events: [], homework: [] }) }
}));
vi.mock('../../services/weather', () => ({ weatherClientService: { getForecastWithHourly: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/settings', () => ({ settingsClientService: { getSettings: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../hooks/useSocket', () => ({
  useSocketStaleData: vi.fn(),
  getSocket: vi.fn().mockReturnValue(null),
  initSocket: vi.fn(),
  matchesEntityFilter: vi.fn().mockReturnValue(false),
}));
vi.mock('../../services/meals', () => ({
  mealsClientService: {
    getMealPlans: vi.fn().mockResolvedValue([]),
    getRecipes: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../services/lists', () => ({
  listsClientService: {
    getFrequentItems: vi.fn().mockResolvedValue([]),
    createList: vi.fn(),
    addItem: vi.fn(),
  },
}));
vi.mock('../../services/http', () => ({
  fetchAPI: vi.fn().mockResolvedValue([]),
  API_BASE: '/api',
}));
vi.mock('../../lib/wallMode', () => ({
  getCurrentWallMode: vi.fn().mockReturnValue('ambient'),
}));
vi.mock('../shared/FamilyNote', () => ({ FamilyNote: () => <div>FamilyNote</div> }));
vi.mock('../calendar/WeeklyWeather', () => ({ WeeklyWeather: () => <div>WeeklyWeather</div> }));
vi.mock('../shared/IntelligenceHeader', () => ({ IntelligenceHeader: () => <div>IntelligenceHeader</div> }));
vi.mock('../shared/FrequentItemChips', () => ({ FrequentItemChips: () => <div>FrequentItemChips</div> }));

const baseProps = {
  parentId: 'p1',
  profile: { uid: 'p1', name: 'Parent', role: 'parent' as const, parentId: 'p1', email: 'p@test.com' },
  kids: [],
  memberColorMap: {},
  isLocked: false,
  onManage: vi.fn(),
  justWoke: false,
};

describe('WallHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({ tasks: [], completions: [], events: [], homework: [], lists: [], listItems: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders wall-clock testid', async () => {
    render(
      <DisplayContext.Provider value={{ isWallMode: false, isSleepMode: false }}>
        <WallHome {...baseProps} />
      </DisplayContext.Provider>
    );
    expect(await screen.findByTestId('wall-clock')).toBeInTheDocument();
  });

  it('clock uses large text in wall mode', async () => {
    render(
      <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
        <WallHome {...baseProps} isLocked={true} />
      </DisplayContext.Provider>
    );
    const clock = await screen.findByTestId('wall-clock');
    expect(clock.querySelector('.text-7xl')).toBeTruthy();
  });

  it('clock uses normal text when not in wall mode', async () => {
    render(
      <DisplayContext.Provider value={{ isWallMode: false, isSleepMode: false }}>
        <WallHome {...baseProps} />
      </DisplayContext.Provider>
    );
    const clock = await screen.findByTestId('wall-clock');
    expect(clock.querySelector('.text-4xl')).toBeTruthy();
  });

  it('keeps current legacy events visible on the home screen after their start time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-16T10:30:00'));
    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({
      tasks: [],
      completions: [],
      events: [{
        id: 'evt_active',
        parentId: 'p1',
        title: 'Reading block',
        description: '',
        startTime: new Date('2026-06-16T10:00:00').getTime(),
        endTime: new Date('2026-06-16T10:00:00').getTime(),
        color: '#6366f1',
      }],
      homework: [],
      lists: [],
      listItems: [],
    });

    render(
      <DisplayContext.Provider value={{ isWallMode: false, isSleepMode: false }}>
        <WallHome {...baseProps} />
      </DisplayContext.Provider>
    );

    expect(await screen.findByText('Reading block')).toBeInTheDocument();
  });

  it('shows kid avatar card with name and task count in wall mode', async () => {
    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({
      tasks: [
        { id: 't1', title: 'Make bed', status: 'active', assignedKidId: 'k1' },
        { id: 't2', title: 'Dishes', status: 'active', assignedKidId: 'k1' },
      ] as any,
      completions: [],
      events: [],
      homework: [],
      lists: [],
      listItems: [],
    });

    render(
      <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
        <WallHome
          {...baseProps}
          isLocked={true}
          kids={[{ uid: 'k1', name: 'Emma', role: 'kid' as const, parentId: 'p1', email: 'e@test.com' }]}
          memberColorMap={{ k1: '#6366f1' }}
        />
      </DisplayContext.Provider>
    );
    expect(await screen.findByText('Emma')).toBeInTheDocument();
    expect(await screen.findByText('0 of 2 done')).toBeInTheDocument();
  });

  it('expands kid card on click in wall mode', async () => {
    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({
      tasks: [
        { id: 't1', title: 'Make bed', status: 'active', assignedKidId: 'k1' },
      ] as any,
      completions: [],
      events: [],
      homework: [],
      lists: [],
      listItems: [],
    });

    render(
      <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
        <WallHome
          {...baseProps}
          isLocked={true}
          kids={[{ uid: 'k1', name: 'Emma', role: 'kid' as const, parentId: 'p1', email: 'e@test.com' }]}
          memberColorMap={{ k1: '#6366f1' }}
        />
      </DisplayContext.Provider>
    );
    const emmaCard = await screen.findByText('Emma');
    fireEvent.click(emmaCard.closest('[data-testid="kid-card-k1"]')!);
    expect(await screen.findByText('Make bed')).toBeInTheDocument();
  });

  it('does not render IntelligenceHeader in resting wall mode', async () => {
    render(
      <DisplayContext.Provider value={{ isWallMode: true, isSleepMode: false }}>
        <WallHome {...baseProps} isLocked={true} justWoke={false} />
      </DisplayContext.Provider>
    );
    // Wait for load
    await screen.findByTestId('wall-clock');
    expect(screen.queryByText('IntelligenceHeader')).not.toBeInTheDocument();
  });
});

