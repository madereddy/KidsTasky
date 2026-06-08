import React, { useEffect, useRef, useState } from 'react';
import { format, startOfWeek, addWeeks, subWeeks, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, Edit3, ExternalLink, Plus, Star, Trash2, Upload, UtensilsCrossed } from 'lucide-react';
import { Recipe } from '../../types';
import { RecipeFormModal } from './RecipeFormModal';
import { cn } from '../../lib/utils';
import { useMealPlanController } from '../../hooks/useMealPlanController';
import { mealsClientService } from '../../services/meals';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface Props { parentId: string; }

export function MealPlanView({ parentId }: Props) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [pickerCell, setPickerCell] = useState<{ date: string; mealType: string } | null>(null);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const {
    recipes,
    deletingRecipe,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    assignMeal,
    getMeal,
  } = useMealPlanController({ parentId, currentWeek });
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  useEffect(() => {
    const rawDraft = localStorage.getItem('kidtasker_shared_recipe_draft');
    if (!rawDraft) return;
    try {
      const draft = JSON.parse(rawDraft) as { title?: string; text?: string; url?: string };
      setEditingRecipe({
        id: '',
        parentId,
        name: draft.title || 'Imported recipe',
        ingredients: '[]',
        instructions: draft.text || '',
        sourceUrl: draft.url || '',
        favorite: 0,
      });
      setShowRecipeForm(true);
    } catch {
      // Ignore malformed share payloads.
    } finally {
      localStorage.removeItem('kidtasker_shared_recipe_draft');
    }
  }, [parentId]);

  const exportRecipe = async (recipe: Recipe) => {
    const payload = await mealsClientService.exportRecipe(recipe.id);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recipe.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'recipe'}.kidtasky-recipe.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importRecipeFile = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = await mealsClientService.importRecipe(parsed);
    addRecipe(imported);
    setSelectedRecipe(imported);
  };

  return (
    <div className="space-y-6" onClick={() => setPickerCell(null)}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Weekly Grid */}
        <div className="flex-[2] bg-white rounded-2xl border border-ui shadow-sm overflow-hidden">
          {/* Week nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ui bg-ui-soft">
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setCurrentWeek(d => subWeeks(d, 1)); }} className="p-2 hover:bg-ui-soft-3 rounded-full">
                <ChevronLeft size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentWeek(new Date()); }} className="px-3 py-1.5 text-xs font-semibold bg-white border border-ui rounded-lg hover:bg-ui-soft">
                This Week
              </button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentWeek(d => addWeeks(d, 1)); }} className="p-2 hover:bg-ui-soft-3 rounded-full">
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="text-sm font-semibold text-ui-secondary">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="w-24 py-2 px-3 text-left text-xs font-bold text-ui-muted-2 uppercase border-b border-r border-ui-soft">Meal</th>
                  {days.map(day => (
                    <th key={day.toISOString()} className={cn(
                      "py-2 px-2 text-center border-b border-r border-ui-soft last:border-r-0",
                      isSameDay(day, today) && "bg-blue-50"
                    )}>
                      <p className="text-[10px] font-bold text-ui-muted-2 uppercase">{format(day, 'EEE')}</p>
                      <p className={cn("text-sm font-bold", isSameDay(day, today) ? "text-blue-500" : "text-ui-secondary")}>
                        {format(day, 'd')}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map(mealType => (
                  <tr key={mealType}>
                    <td className="py-2 px-3 text-xs font-bold text-ui-muted border-b border-r border-ui-soft bg-ui-soft">
                      {mealType}
                    </td>
                    {days.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const meal = getMeal(dateStr, mealType);
                      const isOpen = pickerCell?.date === dateStr && pickerCell?.mealType === mealType;
                      return (
                        <td key={day.toISOString()} className={cn(
                          "py-1 px-1 border-b border-r border-ui-soft last:border-r-0 relative align-top",
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
                              className="w-full flex items-center justify-center py-2 text-ui-muted-2 hover:text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          )}

                          {isOpen && (
                            <div className="absolute top-full left-0 z-50 bg-white border border-ui rounded-xl shadow-xl w-48 p-2 mt-1" onClick={e => e.stopPropagation()}>
                              <p className="text-[10px] font-bold uppercase text-ui-muted-2 px-2 pb-1">Pick recipe</p>
                              <div className="max-h-40 overflow-y-auto space-y-0.5">
                                {recipes.map(r => (
                                  <button key={r.id} onClick={() => { void assignMeal(dateStr, mealType, r.id); setPickerCell(null); }}
                                    className="w-full text-left px-2 py-1.5 text-xs font-semibold hover:bg-blue-50 rounded-lg truncate">
                                    {r.name}
                                  </button>
                                ))}
                                {recipes.length === 0 && <p className="text-xs text-ui-muted-2 px-2 py-1">No recipes yet</p>}
                              </div>
                              {meal && (
                                <button onClick={() => { void assignMeal(dateStr, mealType, null); setPickerCell(null); }}
                                  className="w-full text-left px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-50 rounded-lg mt-1 font-semibold">
                                  Clear
                                </button>
                              )}
                              <button onClick={() => setPickerCell(null)} className="w-full text-center text-xs text-ui-muted-2 hover:text-ui-secondary py-1">Cancel</button>
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
        <div className="flex-1 bg-white rounded-2xl border border-ui shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ui bg-ui-soft">
            <h3 className="text-sm font-bold text-ui-secondary">Recipe Library</h3>
            <button onClick={(e) => { e.stopPropagation(); setShowRecipeForm(true); }}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg">
              <Plus size={12} /> New
            </button>
            <button onClick={(e) => { e.stopPropagation(); importInputRef.current?.click(); }}
              className="flex items-center gap-1 text-xs font-semibold text-ui-secondary bg-white hover:bg-ui-soft px-3 py-1.5 rounded-lg border border-ui">
              <Upload size={12} /> Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importRecipeFile(file);
              }}
            />
          </div>

          {recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ui-muted-2">
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
                  <div key={r.id} className={cn("p-3 cursor-pointer hover:bg-ui-soft transition-colors", isSelected && "bg-blue-50")}>
                    <div className="flex items-center justify-between" onClick={() => setSelectedRecipe(isSelected ? null : r)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ui-primary truncate">
                          {Boolean(r.favorite) && <Star size={12} className="inline mr-1 fill-amber-400 text-amber-400" />}
                          {r.name}
                        </p>
                        <p className="text-[10px] text-ui-muted-2 font-medium mt-0.5">
                          {ings.length} ingredient{ings.length !== 1 ? 's' : ''}
                          {r.servings ? ` • ${r.servings} servings` : ''}
                          {r.prepTimeMinutes || r.cookTimeMinutes ? ` • ${(Number(r.prepTimeMinutes) || 0) + (Number(r.cookTimeMinutes) || 0)} min` : ''}
                        </p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setEditingRecipe(r); setShowRecipeForm(true); }}
                        className="p-1.5 text-ui-muted-2 hover:text-blue-500 transition-colors ml-2" aria-label={`Edit ${r.name}`}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); void exportRecipe(r); }}
                        className="p-1.5 text-ui-muted-2 hover:text-emerald-600 transition-colors" aria-label={`Export ${r.name}`}>
                        <Download size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${r.name}"?`)) { void deleteRecipe(r.id); if (selectedRecipe?.id === r.id) setSelectedRecipe(null); } }}
                        disabled={deletingRecipe === r.id}
                        className="p-1.5 text-ui-muted-2 hover:text-rose-500 transition-colors ml-2">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {isSelected && ings.length > 0 && (
                      <div className="mt-2 space-y-3">
                        {r.imageUrl && <img src={r.imageUrl} alt="" className="w-full max-h-40 object-cover rounded-xl border border-ui" />}
                        <ul className="space-y-0.5">
                          {ings.map((ing, i) => (
                            <li key={i} className="text-xs text-ui-secondary flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              {ing}
                            </li>
                          ))}
                        </ul>
                        {r.instructions && <p className="text-xs text-ui-secondary whitespace-pre-wrap">{r.instructions}</p>}
                        {r.notes && <p className="text-xs text-ui-muted bg-ui-soft rounded-xl p-2 whitespace-pre-wrap">{r.notes}</p>}
                        {r.sourceUrl && (
                          <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                            Source <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showRecipeForm && (
        <RecipeFormModal
          parentId={parentId}
          recipe={editingRecipe}
          onClose={() => { setShowRecipeForm(false); setEditingRecipe(null); }}
          onCreated={(recipe) => {
            editingRecipe?.id ? updateRecipe(recipe) : addRecipe(recipe);
            setSelectedRecipe(recipe);
          }}
        />
      )}
    </div>
  );
}

