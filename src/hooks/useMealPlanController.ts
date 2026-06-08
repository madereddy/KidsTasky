import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfWeek } from 'date-fns';
import { removeEntityById, sortEntities, upsertEntityByIdSorted } from '../lib/entity-list';
import { MealPlanWithRecipe, mealsClientService } from '../services/meals';
import { Recipe } from '../types';
import { useSocketStaleData } from './useSocket';

interface UseMealPlanControllerOptions {
  parentId: string;
  currentWeek: Date;
}

const compareRecipes = (left: Recipe, right: Recipe) => left.name.localeCompare(right.name);

const compareMealPlans = (left: MealPlanWithRecipe, right: MealPlanWithRecipe) => {
  const dateCompare = left.date.localeCompare(right.date);
  if (dateCompare !== 0) return dateCompare;
  return left.mealType.localeCompare(right.mealType);
};

export function useMealPlanController({ parentId, currentWeek }: UseMealPlanControllerOptions) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlanWithRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [loadingMealPlans, setLoadingMealPlans] = useState(true);
  const [deletingRecipe, setDeletingRecipe] = useState<string | null>(null);

  const weekStartStr = useMemo(
    () => format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    [currentWeek],
  );

  const loadRecipes = useCallback(async () => {
    setLoadingRecipes(true);
    try {
      const nextRecipes = await mealsClientService.getRecipes(parentId);
      setRecipes(sortEntities(nextRecipes || [], compareRecipes));
    } finally {
      setLoadingRecipes(false);
    }
  }, [parentId]);

  const loadMealPlans = useCallback(async () => {
    setLoadingMealPlans(true);
    try {
      const nextMealPlans = await mealsClientService.getMealPlans(parentId, weekStartStr);
      setMealPlans(sortEntities(nextMealPlans || [], compareMealPlans));
    } finally {
      setLoadingMealPlans(false);
    }
  }, [parentId, weekStartStr]);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    void loadMealPlans();
  }, [loadMealPlans]);

  useSocketStaleData(['recipes', 'meal_plans'], () => {
    void Promise.all([loadRecipes(), loadMealPlans()]);
  });

  const addRecipe = useCallback((recipe: Recipe) => {
    setRecipes((prev) => upsertEntityByIdSorted(prev, recipe, compareRecipes));
  }, []);

  const updateRecipe = useCallback((recipe: Recipe) => {
    setRecipes((prev) => upsertEntityByIdSorted(prev, recipe, compareRecipes));
    setMealPlans((prev) => prev.map((plan) => (
      plan.recipeId === recipe.id ? { ...plan, recipeName: recipe.name } : plan
    )));
  }, []);

  const deleteRecipe = async (recipeId: string) => {
    setDeletingRecipe(recipeId);
    try {
      await mealsClientService.deleteRecipe(recipeId);
      setRecipes((prev) => removeEntityById(prev, recipeId));
      setMealPlans((prev) => prev.map((plan) => (
        plan.recipeId === recipeId
          ? { ...plan, recipeId: '', recipeName: undefined }
          : plan
      )));
    } finally {
      setDeletingRecipe(null);
    }
  };

  const assignMeal = async (date: string, mealType: string, recipeId: string | null) => {
    await mealsClientService.setMealPlan(parentId, date, mealType, recipeId);

    if (!recipeId) {
      setMealPlans((prev) => prev.filter((plan) => !(plan.date === date && plan.mealType === mealType)));
      return;
    }

    const recipe = recipes.find((entry) => entry.id === recipeId);
    const optimisticPlan: MealPlanWithRecipe = {
      id: `${parentId}:${date}:${mealType}`,
      parentId,
      date,
      mealType,
      recipeId,
      recipeName: recipe?.name,
    };

    setMealPlans((prev) => {
      const current = prev.find((plan) => plan.date === date && plan.mealType === mealType);
      if (!current) return upsertEntityByIdSorted(prev, optimisticPlan, compareMealPlans);
      return sortEntities(
        prev.map((plan) => (
          plan.date === date && plan.mealType === mealType
            ? { ...plan, recipeId, recipeName: recipe?.name }
            : plan
        )),
        compareMealPlans,
      );
    });
  };

  const getMeal = useCallback((date: string, mealType: string) =>
    mealPlans.find((meal) => meal.date === date && meal.mealType === mealType), [mealPlans]);

  return {
    weekStartStr,
    recipes,
    mealPlans,
    loadingRecipes,
    loadingMealPlans,
    deletingRecipe,
    loadRecipes,
    loadMealPlans,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    assignMeal,
    getMeal,
  };
}
