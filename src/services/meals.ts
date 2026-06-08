import { fetchAPI } from './http';
import { Recipe, MealPlan } from '../types';

export type MealPlanWithRecipe = MealPlan & { recipeName?: string };
export type RecipeInput = {
  name: string;
  ingredients: string[];
  instructions?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  favorite?: boolean | number | null;
};

export const mealsClientService = {
  getRecipes: (parentId: string): Promise<Recipe[]> =>
    fetchAPI(`/parents/${parentId}/recipes`),
  createRecipe: (parentId: string, nameOrPayload: string | RecipeInput, ingredients: string[] = []): Promise<Recipe> => {
    const payload = typeof nameOrPayload === 'string'
      ? { parentId, name: nameOrPayload, ingredients }
      : { parentId, ...nameOrPayload };
    return fetchAPI('/recipes', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateRecipe: (id: string, payload: Partial<RecipeInput>): Promise<Recipe> =>
    fetchAPI(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRecipe: (id: string): Promise<void> =>
    fetchAPI(`/recipes/${id}`, { method: 'DELETE' }),
  exportRecipe: (id: string): Promise<{ format: string; recipe: Recipe }> =>
    fetchAPI(`/recipes/${id}/export`),
  importRecipe: (payload: RecipeInput | { recipe: Recipe }): Promise<Recipe> =>
    fetchAPI('/recipes/import', { method: 'POST', body: JSON.stringify(payload) }),
  getMealPlans: (parentId: string, weekStart: string): Promise<MealPlanWithRecipe[]> =>
    fetchAPI(`/parents/${parentId}/meal-plans?weekStart=${weekStart}`),
  setMealPlan: (parentId: string, date: string, mealType: string, recipeId: string | null): Promise<void> =>
    fetchAPI('/meal-plans', { method: 'POST', body: JSON.stringify({ parentId, date, mealType, recipeId }) }),
  deleteMealPlan: (id: string): Promise<void> =>
    fetchAPI(`/meal-plans/${id}`, { method: 'DELETE' }),
};
