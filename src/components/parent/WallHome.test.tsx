import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WallHome } from './WallHome';
import { DisplayContext } from '../../contexts/DisplayContext';

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
};

describe('WallHome', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
