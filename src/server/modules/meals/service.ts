import { db } from '../../db.js';
import { Recipe, MealPlan } from '../../../types.js';
import { randomUUID } from 'crypto';

export const mealsService = {
  getRecipes: (parentId: string): Recipe[] => {
    return db.prepare('SELECT * FROM recipes WHERE parentId = ?').all(parentId) as Recipe[];
  },
  getRecipeById: (id: string): Recipe | undefined => {
    return db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Recipe | undefined;
  },
  getMealPlans: (parentId: string, date: string): MealPlan[] => {
    return db.prepare('SELECT * FROM meal_plans WHERE parentId = ? AND date = ?').all(parentId, date) as MealPlan[];
  },
  getMealPlanById: (id: string): MealPlan | undefined => {
    return db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(id) as MealPlan | undefined;
  },
  createRecipe: (parentId: string, name: string, ingredients: string[]): Recipe => {
    const id = randomUUID();
    db.prepare('INSERT INTO recipes (id, parentId, name, ingredients) VALUES (?, ?, ?, ?)')
      .run(id, parentId, name, JSON.stringify(ingredients));
    return { id, parentId, name, ingredients: JSON.stringify(ingredients) };
  },
  deleteRecipe: (id: string) => {
    db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  },
  getMealPlansForWeek: (parentId: string, weekStart: string): (MealPlan & { recipeName?: string })[] => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const weekEnd = end.toISOString().slice(0, 10);
    return db.prepare(`
      SELECT mp.*, r.name as recipeName
      FROM meal_plans mp
      LEFT JOIN recipes r ON mp.recipeId = r.id
      WHERE mp.parentId = ? AND mp.date BETWEEN ? AND ?
      ORDER BY mp.date, mp.mealType
    `).all(parentId, weekStart, weekEnd) as (MealPlan & { recipeName?: string })[];
  },
  setMealPlan: (parentId: string, date: string, mealType: string, recipeId: string | null): void => {
    const existing = db.prepare('SELECT id FROM meal_plans WHERE parentId = ? AND date = ? AND mealType = ?').get(parentId, date, mealType) as { id: string } | undefined;
    if (existing) {
      if (recipeId === null) {
        db.prepare('DELETE FROM meal_plans WHERE id = ?').run(existing.id);
      } else {
        db.prepare('UPDATE meal_plans SET recipeId = ? WHERE id = ?').run(recipeId, existing.id);
      }
    } else if (recipeId !== null) {
      const id = randomUUID();
      db.prepare('INSERT INTO meal_plans (id, parentId, date, mealType, recipeId) VALUES (?, ?, ?, ?, ?)').run(id, parentId, date, mealType, recipeId);
    }
  },
  deleteMealPlan: (id: string) => {
    db.prepare('DELETE FROM meal_plans WHERE id = ?').run(id);
  },
};
