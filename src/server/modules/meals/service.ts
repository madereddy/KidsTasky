import { db } from '../../db.js';
import { Recipe, MealPlan } from '../../../types.js';
import { randomUUID } from 'crypto';

export interface RecipePayload {
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
}

function normalizeRecipePayload(payload: RecipePayload) {
  return {
    name: String(payload.name || '').trim(),
    ingredients: Array.isArray(payload.ingredients) ? payload.ingredients.map(String).filter(Boolean) : [],
    instructions: payload.instructions ? String(payload.instructions) : null,
    notes: payload.notes ? String(payload.notes) : null,
    sourceUrl: payload.sourceUrl ? String(payload.sourceUrl) : null,
    imageUrl: payload.imageUrl ? String(payload.imageUrl) : null,
    servings: Number.isFinite(Number(payload.servings)) ? Number(payload.servings) : null,
    prepTimeMinutes: Number.isFinite(Number(payload.prepTimeMinutes)) ? Number(payload.prepTimeMinutes) : null,
    cookTimeMinutes: Number.isFinite(Number(payload.cookTimeMinutes)) ? Number(payload.cookTimeMinutes) : null,
    favorite: payload.favorite ? 1 : 0,
  };
}

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
  createRecipe: (parentId: string, nameOrPayload: string | RecipePayload, ingredients: string[] = []): Recipe => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const payload = typeof nameOrPayload === 'string'
      ? normalizeRecipePayload({ name: nameOrPayload, ingredients })
      : normalizeRecipePayload(nameOrPayload);
    if (!payload.name) throw new Error('Recipe name is required');
    db.prepare(`
      INSERT INTO recipes (
        id, parentId, name, ingredients, instructions, notes, sourceUrl, imageUrl,
        servings, prepTimeMinutes, cookTimeMinutes, favorite, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      parentId,
      payload.name,
      JSON.stringify(payload.ingredients),
      payload.instructions,
      payload.notes,
      payload.sourceUrl,
      payload.imageUrl,
      payload.servings,
      payload.prepTimeMinutes,
      payload.cookTimeMinutes,
      payload.favorite,
      now,
      now,
    );
    return db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Recipe;
  },
  updateRecipe: (id: string, payload: Partial<RecipePayload>): Recipe => {
    const current = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Recipe | undefined;
    if (!current) throw new Error('Recipe not found');
    const currentIngredients = (() => {
      try { return JSON.parse(current.ingredients) as string[]; } catch { return []; }
    })();
    const normalized = normalizeRecipePayload({
      name: payload.name ?? current.name,
      ingredients: payload.ingredients ?? currentIngredients,
      instructions: payload.instructions ?? current.instructions ?? null,
      notes: payload.notes ?? current.notes ?? null,
      sourceUrl: payload.sourceUrl ?? current.sourceUrl ?? null,
      imageUrl: payload.imageUrl ?? current.imageUrl ?? null,
      servings: payload.servings ?? current.servings ?? null,
      prepTimeMinutes: payload.prepTimeMinutes ?? current.prepTimeMinutes ?? null,
      cookTimeMinutes: payload.cookTimeMinutes ?? current.cookTimeMinutes ?? null,
      favorite: payload.favorite ?? current.favorite ?? 0,
    });
    if (!normalized.name) throw new Error('Recipe name is required');
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE recipes
      SET name = ?, ingredients = ?, instructions = ?, notes = ?, sourceUrl = ?, imageUrl = ?,
          servings = ?, prepTimeMinutes = ?, cookTimeMinutes = ?, favorite = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      normalized.name,
      JSON.stringify(normalized.ingredients),
      normalized.instructions,
      normalized.notes,
      normalized.sourceUrl,
      normalized.imageUrl,
      normalized.servings,
      normalized.prepTimeMinutes,
      normalized.cookTimeMinutes,
      normalized.favorite,
      now,
      id,
    );
    return db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Recipe;
  },
  importRecipe: (parentId: string, payload: RecipePayload): Recipe => {
    return mealsService.createRecipe(parentId, payload);
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
