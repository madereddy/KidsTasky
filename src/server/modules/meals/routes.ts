import { Router } from 'express';
import { mealsService } from './service.js';
import { authenticateUser, assertParentScope, getParentId, requireRole, enforceEditUnlocked } from '../../middleware/auth.js';

export const mealsRouter = Router();

mealsRouter.get('/parents/:parentId/recipes', authenticateUser, assertParentScope, (req, res) => {
  try {
    res.json(mealsService.getRecipes(req.params.parentId as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.post('/recipes', authenticateUser, requireRole('parent'), enforceEditUnlocked, (req, res) => {
  try {
    const parentId = getParentId(req);
    const result = mealsService.createRecipe(parentId, req.body);
    res.status(201).json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.put('/recipes/:id', authenticateUser, requireRole('parent'), enforceEditUnlocked, (req, res) => {
  try {
    const recipe = mealsService.getRecipeById(String(req.params.id));
    if (!recipe) return res.status(404).json({ error: 'Not found' });
    if (recipe.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const result = mealsService.updateRecipe(String(req.params.id), req.body);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.get('/recipes/:id/export', authenticateUser, requireRole('parent'), (req, res) => {
  try {
    const recipe = mealsService.getRecipeById(String(req.params.id));
    if (!recipe) return res.status(404).json({ error: 'Not found' });
    if (recipe.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    res.json({ format: 'kidtasky.recipe.v1', recipe });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.post('/recipes/import', authenticateUser, requireRole('parent'), enforceEditUnlocked, (req, res) => {
  try {
    const parentId = getParentId(req);
    const source = req.body?.recipe && typeof req.body.recipe === 'object' ? req.body.recipe : req.body;
    const ingredients = Array.isArray(source.ingredients)
      ? source.ingredients
      : (() => { try { return JSON.parse(source.ingredients || '[]'); } catch { return []; } })();
    const result = mealsService.importRecipe(parentId, { ...source, ingredients });
    res.status(201).json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.delete('/recipes/:id', authenticateUser, requireRole('parent'), enforceEditUnlocked, (req, res) => {
  try {
    const recipe = mealsService.getRecipeById(String(req.params.id));
    if (!recipe) return res.status(404).json({ error: 'Not found' });
    if (recipe.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    mealsService.deleteRecipe(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.get('/parents/:parentId/meal-plans', authenticateUser, assertParentScope, (req, res) => {
  try {
    const { weekStart } = req.query;
    const plans = mealsService.getMealPlansForWeek(req.params.parentId as string, weekStart as string);
    res.json(plans);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.post('/meal-plans', authenticateUser, requireRole('parent'), enforceEditUnlocked, (req, res) => {
  try {
    const parentId = getParentId(req);
    const { date, mealType, recipeId } = req.body;
    mealsService.setMealPlan(parentId, date, mealType, recipeId ?? null);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.delete('/meal-plans/:id', authenticateUser, requireRole('parent'), enforceEditUnlocked, (req, res) => {
  try {
    const plan = mealsService.getMealPlanById(String(req.params.id));
    if (!plan) return res.status(404).json({ error: 'Not found' });
    const userParentId = getParentId(req);
    if (plan.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

    mealsService.deleteMealPlan(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
