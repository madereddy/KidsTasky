// src/server/modules/meals/routes.ts
import { Router } from 'express';
import { mealsService } from './service.js';

export const mealsRouter = Router();

mealsRouter.get('/parents/:parentId/recipes', (req, res) => {
  try {
    const recipes = mealsService.getRecipes(req.params.parentId);
    res.json(recipes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
