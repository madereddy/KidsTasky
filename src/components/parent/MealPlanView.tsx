import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addWeeks, subWeeks, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { mealsClientService, MealPlanWithRecipe } from '../../services/meals';
import { Recipe } from '../../types';
import { RecipeFormModal } from './RecipeFormModal';
import { cn } from '../../lib/utils';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface Props { parentId: string; }

export function MealPlanView({ parentId }: Props) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlanWithRecipe[]>([]);
  const [pickerCell, setPickerCell] = useState<{ date: string; mealType: string } | null>(null);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [deletingRecipe, setDeletingRecipe] = useState<string | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const fetchRecipes = useCallback(async () => {
    const r = await mealsClientService.getRecipes(parentId);
    setRecipes(r || []);
  }, [parentId]);

  const fetchMealPlans = useCallback(async () => {
    const p = await mealsClientService.getMealPlans(parentId, weekStartStr);
    setMealPlans(p || []);
  }, [parentId, weekStartStr]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);
  useEffect(() => { fetchMealPlans(); }, [fetchMealPlans]);

  const getMeal = (date: string, mealType: string) =>
    mealPlans.find(m => m.date === date && m.mealType === mealType);

  const assignMeal = async (date: string, mealType: string, recipeId: string | null) => {
    await mealsClientService.setMealPlan(parentId, date, mealType, recipeId);
    setPickerCell(null);
    fetchMealPlans();
  };

  const deleteRecipe = async (id: string) => {
    setDeletingRecipe(id);
    try {
      await mealsClientService.deleteRecipe(id);
      if (selectedRecipe?.id === id) setSelectedRecipe(null);
      fetchRecipes();
    } finally {
      setDeletingRecipe(null);
    }
  };

  return (
    <div className="space-y-6" onClick={() => setPickerCell(null)}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Weekly Grid */}
        <div className="flex-[2] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Week nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setCurrentWeek(d => subWeeks(d, 1)); }} className="p-2 hover:bg-slate-200 rounded-full">
                <ChevronLeft size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentWeek(new Date()); }} className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                This Week
              </button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentWeek(d => addWeeks(d, 1)); }} className="p-2 hover:bg-slate-200 rounded-full">
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="text-sm font-semibold text-slate-700">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="w-24 py-2 px-3 text-left text-xs font-bold text-slate-400 uppercase border-b border-r border-slate-100">Meal</th>
                  {days.map(day => (
                    <th key={day.toISOString()} className={cn(
                      "py-2 px-2 text-center border-b border-r border-slate-100 last:border-r-0",
                      isSameDay(day, today) && "bg-blue-50"
                    )}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{format(day, 'EEE')}</p>
                      <p className={cn("text-sm font-bold", isSameDay(day, today) ? "text-blue-500" : "text-slate-700")}>
                        {format(day, 'd')}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map(mealType => (
                  <tr key={mealType}>
                    <td className="py-2 px-3 text-xs font-bold text-slate-500 border-b border-r border-slate-100 bg-slate-50">
                      {mealType}
                    </td>
                    {days.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const meal = getMeal(dateStr, mealType);
                      const isOpen = pickerCell?.date === dateStr && pickerCell?.mealType === mealType;
                      return (
                        <td key={day.toISOString()} className={cn(
                          "py-1 px-1 border-b border-r border-slate-100 last:border-r-0 relative align-top",
                          isSameDay(day, today) && "bg-blue-50/30"
                        )}>
                          {meal ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPickerCell({ date: dateStr, mealType }); }}
                              className="w-full text-left px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800 hover:bg-amber-100 truncate"
                            >
                              {meal.recipeName ?? 'Planned'}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPickerCell({ date: dateStr, mealType }); }}
                              className="w-full flex items-center justify-center py-2 text-slate-300 hover:text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          )}

                          {isOpen && (
                            <div className="absolute top-full left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-48 p-2 mt-1" onClick={e => e.stopPropagation()}>
                              <p className="text-[10px] font-bold uppercase text-slate-400 px-2 pb-1">Pick recipe</p>
                              <div className="max-h-40 overflow-y-auto space-y-0.5">
                                {recipes.map(r => (
                                  <button key={r.id} onClick={() => assignMeal(dateStr, mealType, r.id)}
                                    className="w-full text-left px-2 py-1.5 text-xs font-semibold hover:bg-blue-50 rounded-lg truncate">
                                    {r.name}
                                  </button>
                                ))}
                                {recipes.length === 0 && <p className="text-xs text-slate-400 px-2 py-1">No recipes yet</p>}
                              </div>
                              {meal && (
                                <button onClick={() => assignMeal(dateStr, mealType, null)}
                                  className="w-full text-left px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-50 rounded-lg mt-1 font-semibold">
                                  Clear
                                </button>
                              )}
                              <button onClick={() => setPickerCell(null)} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1">Cancel</button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Recipe Library */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700">Recipe Library</h3>
            <button onClick={(e) => { e.stopPropagation(); setShowRecipeForm(true); }}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg">
              <Plus size={12} /> New
            </button>
          </div>

          {recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <UtensilsCrossed size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-semibold">No recipes yet</p>
              <p className="text-xs mt-1">Add your first recipe!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recipes.map(r => {
                const ings = (() => { try { return JSON.parse(r.ingredients) as string[]; } catch { return []; } })();
                const isSelected = selectedRecipe?.id === r.id;
                return (
                  <div key={r.id} className={cn("p-3 cursor-pointer hover:bg-slate-50 transition-colors", isSelected && "bg-blue-50")}>
                    <div className="flex items-center justify-between" onClick={() => setSelectedRecipe(isSelected ? null : r)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{ings.length} ingredient{ings.length !== 1 ? 's' : ''}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${r.name}"?`)) deleteRecipe(r.id); }}
                        disabled={deletingRecipe === r.id}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors ml-2">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {isSelected && ings.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {ings.map((ing, i) => (
                          <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            {ing}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showRecipeForm && (
        <RecipeFormModal parentId={parentId} onClose={() => setShowRecipeForm(false)} onCreated={fetchRecipes} />
      )}
    </div>
  );
}
