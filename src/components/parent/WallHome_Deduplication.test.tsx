import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WallHome } from './WallHome';
import { DisplayContext } from '../../contexts/DisplayContext';
import { listsClientService } from '../../services/lists';
import { dashboardClientService } from '../../services/dashboard';
import { mealsClientService } from '../../services/meals';

vi.mock('../../services/lists', () => ({
  listsClientService: {
    addItem: vi.fn().mockResolvedValue({ id: 'new-item' }),
    createList: vi.fn(),
    getFrequentItems: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('../../services/dashboard', () => ({
  dashboardClientService: {
    getFamilyDashboardData: vi.fn(),
  }
}));

vi.mock('../../services/meals', () => ({
  mealsClientService: {
    getMealPlans: vi.fn().mockResolvedValue([]),
    getRecipes: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('../../services/weather', () => ({
  weatherClientService: {
    getForecastWithHourly: vi.fn().mockResolvedValue({ daily: [], hourlyToday: [] }),
  }
}));

vi.mock('../../services/settings', () => ({
  settingsClientService: {
    getSettings: vi.fn().mockResolvedValue({}),
  }
}));

vi.mock('../../hooks/useSocket', () => ({
  useSocketStaleData: vi.fn(),
  getSocket: vi.fn().mockReturnValue(null),
  initSocket: vi.fn(),
  matchesEntityFilter: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/http', () => ({
  fetchAPI: vi.fn().mockResolvedValue([]),
  API_BASE: '/api',
}));

vi.mock('../../lib/wallMode', () => ({
  getCurrentWallMode: vi.fn().mockReturnValue('ambient'),
}));

// Mock window.alert
window.alert = vi.fn();

const baseProps = {
  parentId: 'p1',
  profile: { uid: 'p1', name: 'Parent', role: 'parent' as const, parentId: 'p1', email: 'p@test.com' },
  kids: [],
  memberColorMap: {},
  isLocked: false,
  onManage: vi.fn(),
};

describe('WallHome Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds only non-duplicate ingredients to the shopping list', async () => {
    // Mock dashboard data with an existing shopping list and one item
    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({
      events: [],
      homework: [],
      tasks: [],
      completions: [],
      lists: [
        { id: 'list-1', title: 'Shopping List', category: 'shopping', isRoutine: 0 } as any
      ],
      listItems: [
        { id: 'item-1', listId: 'list-1', text: 'Milk', completed: 0 } as any
      ]
    });

    // Mock meal data
    vi.mocked(mealsClientService.getMealPlans).mockResolvedValue([
      { id: 'mp-1', date: new Date().toISOString().split('T')[0], recipeId: 'recipe-1' } as any
    ]);
    vi.mocked(mealsClientService.getRecipes).mockResolvedValue([
      { id: 'recipe-1', name: 'Cereal', ingredients: JSON.stringify(['Milk', 'Cereal', 'Sugar']) } as any
    ]);

    render(
      <DisplayContext.Provider value={{ isWallMode: false, isSleepMode: false, isKioskMode: false }}>
        <WallHome {...baseProps} />
      </DisplayContext.Provider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Cereal')).toBeInTheDocument();
    });

    // Click "Add ingredients to list"
    const addButton = screen.getByText('Add ingredients to list');
    fireEvent.click(addButton);

    // Verify addItem was called for 'Cereal' and 'Sugar', but not 'Milk'
    await waitFor(() => {
      expect(listsClientService.addItem).toHaveBeenCalledTimes(2);
    });

    expect(listsClientService.addItem).toHaveBeenCalledWith('list-1', 'Cereal');
    expect(listsClientService.addItem).toHaveBeenCalledWith('list-1', 'Sugar');
    expect(listsClientService.addItem).not.toHaveBeenCalledWith('list-1', 'Milk');
    
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Added 2 new items'));
  });

  it('shows an alert if all items are already on the list', async () => {
    // Mock dashboard data with all items already present
    vi.mocked(dashboardClientService.getFamilyDashboardData).mockResolvedValue({
      events: [],
      homework: [],
      tasks: [],
      completions: [],
      lists: [
        { id: 'list-1', title: 'Shopping List', category: 'shopping', isRoutine: 0 } as any
      ],
      listItems: [
        { id: 'item-1', listId: 'list-1', text: 'Milk', completed: 0 } as any
      ]
    });

    // Mock meal data with only 'Milk'
    vi.mocked(mealsClientService.getMealPlans).mockResolvedValue([
      { id: 'mp-1', date: new Date().toISOString().split('T')[0], recipeId: 'recipe-1' } as any
    ]);
    vi.mocked(mealsClientService.getRecipes).mockResolvedValue([
      { id: 'recipe-1', name: 'Glass of Milk', ingredients: JSON.stringify(['Milk']) } as any
    ]);

    render(
      <DisplayContext.Provider value={{ isWallMode: false, isSleepMode: false, isKioskMode: false }}>
        <WallHome {...baseProps} />
      </DisplayContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Glass of Milk')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Add ingredients to list');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('All ingredients are already on your shopping list!');
    });

    expect(listsClientService.addItem).not.toHaveBeenCalled();
  });
});
