# Plan 04 — Meal Planning UI

**Group:** B (requires Plan 01)
**Blocked by:** Plan 01 (meals display in CalendarDayView)

---

## Problem

The full meal planning schema exists (`recipes`, `meal_plans` tables). `mealsService` has read-only `getRecipes` and `getMealPlans`. The meals router only has `GET /parents/:parentId/recipes`. There is no UI whatsoever.

---

## What Already Exists

- `Recipe` type: `{ id, parentId, name, ingredients: string }` (ingredients is JSON array string)
- `MealPlan` type: `{ id, parentId, date, mealType, recipeId }`
- `src/server/modules/meals/service.ts` — `getRecipes(parentId)`, `getMealPlans(parentId)` (read only)
- `src/server/modules/meals/routes.ts` — `GET /parents/:parentId/recipes` only

---

## Files to Modify

### `src/server/modules/meals/service.ts`
Add write operations:

```ts
createRecipe: (parentId: string, name: string, ingredients: string[]) => {
  const id = randomUUID();
  db.prepare('INSERT INTO recipes (id, parentId, name, ingredients) VALUES (?, ?, ?, ?)')
    .run(id, parentId, name, JSON.stringify(ingredients));
  return { id, parentId, name, ingredients: JSON.stringify(ingredients) };
},
deleteRecipe: (id: string) => {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
},
getMealPlansForWeek: (parentId: string, weekStart: string) => {
  // weekStart is YYYY-MM-DD (Monday of the week)
  const weekEnd = /* add 6 days */ ...;
  return db.prepare('SELECT * FROM meal_plans WHERE parentId = ? AND date BETWEEN ? AND ?')
    .all(parentId, weekStart, weekEnd);
},
setMealPlan: (parentId: string, date: string, mealType: string, recipeId: string | null, quickText?: string) => {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO meal_plans (id, parentId, date, mealType, recipeId)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(parentId, date, mealType) DO UPDATE SET recipeId = excluded.recipeId
  `).run(id, parentId, date, mealType, recipeId);
},
deleteMealPlan: (id: string) => {
  db.prepare('DELETE FROM meal_plans WHERE id = ?').run(id);
},
```

Note: check if `meal_plans` has a unique constraint on `(parentId, date, mealType)`. If not, use a SELECT-then-INSERT-or-UPDATE pattern instead.

### `src/server/modules/meals/routes.ts`
Add write endpoints:

```ts
mealsRouter.post('/recipes', requireAuth, (req, res) => {
  const { name, ingredients } = req.body;
  const result = mealsService.createRecipe(req.user.uid, name, ingredients);
  res.status(201).json(result);
});

mealsRouter.delete('/recipes/:id', requireAuth, (req, res) => {
  mealsService.deleteRecipe(req.params.id);
  res.json({ success: true });
});

mealsRouter.get('/parents/:parentId/meal-plans', requireAuth, (req, res) => {
  const { weekStart } = req.query;
  const plans = mealsService.getMealPlansForWeek(req.params.parentId, weekStart as string);
  res.json(plans);
});

mealsRouter.post('/meal-plans', requireAuth, (req, res) => {
  const { date, mealType, recipeId, quickText } = req.body;
  mealsService.setMealPlan(req.user.uid, date, mealType, recipeId, quickText);
  res.json({ success: true });
});

mealsRouter.delete('/meal-plans/:id', requireAuth, (req, res) => {
  mealsService.deleteMealPlan(req.params.id);
  res.json({ success: true });
});
```

---

## Files to Create

### `src/services/meals.ts`

```ts
import { fetchAPI } from './http';
import { Recipe, MealPlan } from '../types';

export const mealsClientService = {
  getRecipes: (parentId: string): Promise<Recipe[]> =>
    fetchAPI(`/parents/${parentId}/recipes`),
  createRecipe: (name: string, ingredients: string[]): Promise<Recipe> =>
    fetchAPI('/recipes', { method: 'POST', body: JSON.stringify({ name, ingredients }) }),
  deleteRecipe: (id: string): Promise<void> =>
    fetchAPI(`/recipes/${id}`, { method: 'DELETE' }),
  getMealPlans: (parentId: string, weekStart: string): Promise<MealPlan[]> =>
    fetchAPI(`/parents/${parentId}/meal-plans?weekStart=${weekStart}`),
  setMealPlan: (date: string, mealType: string, recipeId: string | null): Promise<void> =>
    fetchAPI('/meal-plans', { method: 'POST', body: JSON.stringify({ date, mealType, recipeId }) }),
  deleteMealPlan: (id: string): Promise<void> =>
    fetchAPI(`/meal-plans/${id}`, { method: 'DELETE' }),
};
```

### `src/components/parent/MealPlanView.tsx`
Main meal planning screen. Two panels side by side on desktop, stacked on mobile.

**Left panel — Weekly Grid**
- Week navigation: prev/next arrows, "This Week" button, current week label
- Grid:
  - Columns: 7 days (Mon–Sun), with date number + day name header
  - Rows: 4 meal types — Breakfast, Lunch, Dinner, Snack
  - Each cell: shows recipe name if assigned, else a `+` button
  - Click `+` or existing meal → open meal picker popover
- Today's column is highlighted

**Meal picker popover** (small inline dropdown):
- List of recipes with click-to-assign
- "Quick text" input for meals without a recipe
- "Clear" option to remove the assignment

**Right panel — Recipe Library**
- List of all saved recipes: name + ingredient count badge
- "New Recipe" button → opens `RecipeFormModal`
- Delete button per recipe (with confirmation)
- Click a recipe → show detail: name + ingredient list

### `src/components/parent/RecipeFormModal.tsx`
Modal for creating a recipe.

- Name input (required)
- Dynamic ingredient list:
  - Each ingredient is a text input
  - "Add ingredient" button appends a new input
  - "×" button removes an ingredient
- Save → calls `mealsClientService.createRecipe(name, ingredients)`

---

## Integration with Calendar (Plan 01 required)

### `src/components/calendar/CalendarDayView.tsx`
At the top of the day view, above events, render a "Meals" section:

```tsx
{dayMeals.length > 0 && (
  <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
    <p className="text-xs font-bold text-amber-700 mb-2">TODAY'S MEALS</p>
    {dayMeals.map(meal => (
      <div key={meal.id} className="flex gap-2 text-sm">
        <span className="text-amber-500 font-semibold w-20">{meal.mealType}</span>
        <span>{meal.recipeName ?? 'Planned'}</span>
      </div>
    ))}
  </div>
)}
```

Pass `dayMeals: MealPlan[]` as an optional prop to `CalendarDayView`.

### `src/App.tsx` or navigation
Add "Meals" tab to parent navigation alongside Calendar and Tasks.

---

## Acceptance Criteria

- [ ] Weekly meal grid renders with correct dates
- [ ] Meals can be assigned to any slot by picking from recipe library
- [ ] Meals display in CalendarDayView at the top of the day
- [ ] Recipes can be created with a name and ingredient list
- [ ] Recipes can be deleted
- [ ] Meal assignments persist after page reload
- [ ] Week navigation moves forward and backward correctly
