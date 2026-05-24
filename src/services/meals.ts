import { fetchAPI } from './http';
import { Recipe, MealPlan } from '../types';

export type MealPlanWithRecipe = MealPlan & { recipeName?: string };

export const mealsClientService = {
  getRecipes: (parentId: string): Promise<Recipe[]> =>
    fetchAPI(`/parents/${parentId}/recipes`),
  createRecipe: (parentId: string, name: string, ingredients: string[]): Promise<Recipe> =>
    fetchAPI('/recipes', { method: 'POST', body: JSON.stringify({ parentId, name, ingredients }) }),
  deleteRecipe: (id: string): Promise<void> =>
    fetchAPI(`/recipes/${id}`, { method: 'DELETE' }),
  getMealPlans: (parentId: string, weekStart: string): Promise<MealPlanWithRecipe[]> =>
    fetchAPI(`/parents/${parentId}/meal-plans?weekStart=${weekStart}`),
  setMealPlan: (parentId: string, date: string, mealType: string, recipeId: string | null): Promise<void> =>
    fetchAPI('/meal-plans', { method: 'POST', body: JSON.stringify({ parentId, date, mealType, recipeId }) }),
  deleteMealPlan: (id: string): Promise<void> =>
    fetchAPI(`/meal-plans/${id}`, { method: 'DELETE' }),
};
