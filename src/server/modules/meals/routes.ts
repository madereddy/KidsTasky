import { Router } from 'express';
import { mealsService } from './service.js';

export const mealsRouter = Router();

mealsRouter.get('/parents/:parentId/recipes', (req, res) => {
  try {
    res.json(mealsService.getRecipes(req.params.parentId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.post('/recipes', (req, res) => {
  try {
    const { parentId, name, ingredients } = req.body;
    const result = mealsService.createRecipe(parentId, name, ingredients);
    res.status(201).json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.delete('/recipes/:id', (req, res) => {
  try {
    mealsService.deleteRecipe(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.get('/parents/:parentId/meal-plans', (req, res) => {
  try {
    const { weekStart } = req.query;
    const plans = mealsService.getMealPlansForWeek(req.params.parentId, weekStart as string);
    res.json(plans);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.post('/meal-plans', (req, res) => {
  try {
    const { parentId, date, mealType, recipeId } = req.body;
    mealsService.setMealPlan(parentId, date, mealType, recipeId ?? null);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

mealsRouter.delete('/meal-plans/:id', (req, res) => {
  try {
    mealsService.deleteMealPlan(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
