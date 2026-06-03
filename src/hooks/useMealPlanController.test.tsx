import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMealPlanController } from './useMealPlanController';
import { mealsClientService } from '../services/meals';

vi.mock('../services/meals', () => ({
  mealsClientService: {
    getRecipes: vi.fn(),
    createRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
    getMealPlans: vi.fn(),
    setMealPlan: vi.fn(),
    deleteMealPlan: vi.fn(),
  },
}));

describe('useMealPlanController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates local meal plans immediately when assigning a meal', async () => {
    vi.mocked(mealsClientService.getRecipes).mockResolvedValueOnce([
      { id: 'r1', parentId: 'p1', name: 'Pasta', ingredients: '[]' },
    ]);
    vi.mocked(mealsClientService.getMealPlans).mockResolvedValueOnce([]);
    vi.mocked(mealsClientService.setMealPlan).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useMealPlanController({ parentId: 'p1', currentWeek: new Date('2026-06-01T12:00:00Z') }),
    );

    await waitFor(() => expect(result.current.recipes).toHaveLength(1));

    await act(async () => {
      await result.current.assignMeal('2026-06-01', 'Dinner', 'r1');
    });

    expect(result.current.getMeal('2026-06-01', 'Dinner')).toMatchObject({
      recipeId: 'r1',
      recipeName: 'Pasta',
    });
  });

  it('removes deleted recipes from the local recipe library', async () => {
    vi.mocked(mealsClientService.getRecipes).mockResolvedValueOnce([
      { id: 'r1', parentId: 'p1', name: 'Pasta', ingredients: '[]' },
      { id: 'r2', parentId: 'p1', name: 'Salad', ingredients: '[]' },
    ]);
    vi.mocked(mealsClientService.getMealPlans).mockResolvedValueOnce([]);
    vi.mocked(mealsClientService.deleteRecipe).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useMealPlanController({ parentId: 'p1', currentWeek: new Date('2026-06-01T12:00:00Z') }),
    );

    await waitFor(() => expect(result.current.recipes).toHaveLength(2));

    await act(async () => {
      await result.current.deleteRecipe('r1');
    });

    expect(result.current.recipes.map((recipe) => recipe.id)).toEqual(['r2']);
  });
});
