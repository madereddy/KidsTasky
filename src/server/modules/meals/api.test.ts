// src/server/modules/meals/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { mealsService } from './service.js';

vi.mock('./service.js', () => ({
  mealsService: {
    getRecipes: vi.fn().mockReturnValue([{ id: 'req_1', parentId: 'parent_1', name: 'Pizza', ingredients: '["Dough"]' }])
  }
}));

describe('Meals API', () => {
  it('should return recipes for a parent', async () => {
    const res = await request(app).get('/api/parents/parent_1/recipes');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Pizza');
  });
});
