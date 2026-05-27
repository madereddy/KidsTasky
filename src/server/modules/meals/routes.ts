import { Router } from 'express';
import { mealsService } from './service.js';
import { authenticateUser, getParentId } from '../../middleware/auth.js';

export const mealsRouter = Router();

mealsRouter.get('/parents/:parentId/recipes', authenticateUser, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    res.json(mealsService.getRecipes(req.params.parentId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.post('/recipes', authenticateUser, (req, res) => {
  try {
    const parentId = getParentId(req);
    const { name, ingredients } = req.body;
    const result = mealsService.createRecipe(parentId, name, ingredients);
    res.status(201).json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.delete('/recipes/:id', authenticateUser, (req, res) => {
  try {
    const recipe = mealsService.getRecipeById(String(req.params.id));
    if (!recipe) return res.status(404).json({ error: 'Not found' });
    const userParentId = getParentId(req);
    if (recipe.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

    mealsService.deleteRecipe(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.get('/parents/:parentId/meal-plans', authenticateUser, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });

    const { weekStart } = req.query;
    const plans = mealsService.getMealPlansForWeek(req.params.parentId, weekStart as string);
    res.json(plans);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.post('/meal-plans', authenticateUser, (req, res) => {
  try {
    const parentId = getParentId(req);
    const { date, mealType, recipeId } = req.body;
    mealsService.setMealPlan(parentId, date, mealType, recipeId ?? null);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.delete('/meal-plans/:id', authenticateUser, (req, res) => {
  try {
    const plan = mealsService.getMealPlanById(String(req.params.id));
    if (!plan) return res.status(404).json({ error: 'Not found' });
    const userParentId = getParentId(req);
    if (plan.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

    mealsService.deleteMealPlan(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
