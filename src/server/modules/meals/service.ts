// src/server/modules/meals/service.ts
import { db } from '../../db.js';
import { Recipe, MealPlan } from '../../../types.js';

export const mealsService = {
  getRecipes: (parentId: string): Recipe[] => {
    return db.prepare('SELECT * FROM recipes WHERE parentId = ?').all(parentId) as Recipe[];
  },
  getMealPlans: (parentId: string, date: string): MealPlan[] => {
    return db.prepare('SELECT * FROM meal_plans WHERE parentId = ? AND date = ?').all(parentId, date) as MealPlan[];
  }
};
