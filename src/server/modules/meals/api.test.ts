// src/server/modules/meals/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../../server.js';
import { mealsService } from './service.js';
import { getJwtSecret } from '../../config.js';

const SECRET = getJwtSecret();

vi.mock('./service.js', () => ({
  mealsService: {
    getRecipes: vi.fn().mockReturnValue([{ id: 'req_1', parentId: 'parent_1', name: 'Pizza', ingredients: '["Dough"]' }]),
    getRecipeById: vi.fn().mockReturnValue({ id: 'req_1', parentId: 'parent_1', name: 'Pizza', ingredients: '["Dough"]' }),
    createRecipe: vi.fn().mockReturnValue({ id: 'req_2', parentId: 'parent_1', name: 'Soup', ingredients: '["Carrot"]' }),
    updateRecipe: vi.fn().mockReturnValue({ id: 'req_1', parentId: 'parent_1', name: 'Better Pizza', ingredients: '["Dough"]' }),
    importRecipe: vi.fn().mockReturnValue({ id: 'req_3', parentId: 'parent_1', name: 'Imported', ingredients: '["Beans"]' }),
    deleteRecipe: vi.fn(),
    getMealPlansForWeek: vi.fn().mockReturnValue([]),
    setMealPlan: vi.fn(),
    getMealPlanById: vi.fn(),
    deleteMealPlan: vi.fn(),
  }
}));

describe('Meals API', () => {
  const parentId = 'parent_1';
  let token: string;

  beforeEach(() => {
    token = jwt.sign({ uid: parentId, role: 'parent', parentId }, SECRET);
  });

  it('should return recipes for a parent', async () => {
    const res = await request(app).get('/api/parents/parent_1/recipes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Pizza');
  });

  it('forbids a kid from creating recipes or meal plans', async () => {
    const kidToken = jwt.sign({ uid: 'kid_meals_1', role: 'kid', parentId }, SECRET);
    const recipe = await request(app).post('/api/recipes')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ name: 'Sneaky Snack', ingredients: '["Candy"]' });
    expect(recipe.status).toBe(403);

    const plan = await request(app).post('/api/meal-plans')
      .set('Authorization', `Bearer ${kidToken}`)
      .send({ date: '2026-06-01', mealType: 'dinner', recipeId: null });
    expect(plan.status).toBe(403);
  });

  it('updates, exports, and imports recipes for the owning parent', async () => {
    const update = await request(app).put('/api/recipes/req_1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Better Pizza', instructions: 'Bake hot.' });
    expect(update.status).toBe(200);
    expect(mealsService.updateRecipe).toHaveBeenCalledWith('req_1', expect.objectContaining({ name: 'Better Pizza' }));

    const exported = await request(app).get('/api/recipes/req_1/export')
      .set('Authorization', `Bearer ${token}`);
    expect(exported.status).toBe(200);
    expect(exported.body.format).toBe('kidtasky.recipe.v1');

    const imported = await request(app).post('/api/recipes/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipe: { name: 'Imported', ingredients: '["Beans"]' } });
    expect(imported.status).toBe(201);
    expect(mealsService.importRecipe).toHaveBeenCalledWith(parentId, expect.objectContaining({ name: 'Imported', ingredients: ['Beans'] }));
  });
});
