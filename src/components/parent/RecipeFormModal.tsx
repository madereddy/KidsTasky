import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { mealsClientService, RecipeInput } from '../../services/meals';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { Recipe } from '../../types';

interface Props {
  parentId: string;
  onClose: () => void;
  onCreated: (recipe: Recipe) => void;
  recipe?: Recipe | null;
}

function parseIngredients(recipe?: Recipe | null) {
  if (!recipe) return [''];
  try {
    const parsed = JSON.parse(recipe.ingredients);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : [''];
  } catch {
    return [''];
  }
}

export function RecipeFormModal({ parentId, onClose, onCreated, recipe }: Props) {
  const isExistingRecipe = Boolean(recipe?.id);
  const { dialogRef, onKeyDown } = useDialogA11y(true, onClose);
  const [name, setName] = useState(recipe?.name ?? '');
  const [ingredients, setIngredients] = useState<string[]>(() => parseIngredients(recipe));
  const [instructions, setInstructions] = useState(recipe?.instructions ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [sourceUrl, setSourceUrl] = useState(recipe?.sourceUrl ?? '');
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl ?? '');
  const [servings, setServings] = useState(recipe?.servings ? String(recipe.servings) : '');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(recipe?.prepTimeMinutes ? String(recipe.prepTimeMinutes) : '');
  const [cookTimeMinutes, setCookTimeMinutes] = useState(recipe?.cookTimeMinutes ? String(recipe.cookTimeMinutes) : '');
  const [favorite, setFavorite] = useState(Boolean(recipe?.favorite));
  const [saving, setSaving] = useState(false);

  const addIngredient = () => setIngredients(prev => [...prev, '']);
  const removeIngredient = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
  const updateIngredient = (i: number, val: string) =>
    setIngredients(prev => prev.map((v, idx) => (idx === i ? val : v)));

  const handleSave = async () => {
    if (!name.trim()) return;
    const filtered = ingredients.filter(s => s.trim());
    setSaving(true);
    try {
      const payload: RecipeInput = {
        name: name.trim(),
        ingredients: filtered,
        instructions: instructions.trim() || null,
        notes: notes.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        imageUrl: imageUrl.trim() || null,
        servings: servings ? Number(servings) : null,
        prepTimeMinutes: prepTimeMinutes ? Number(prepTimeMinutes) : null,
        cookTimeMinutes: cookTimeMinutes ? Number(cookTimeMinutes) : null,
        favorite,
      };
      const saved = isExistingRecipe && recipe
        ? await mealsClientService.updateRecipe(recipe.id, payload)
        : await mealsClientService.createRecipe(parentId, payload);
      onCreated(saved);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ui-deep-80" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-recipe-title" tabIndex={-1} onKeyDown={onKeyDown} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="new-recipe-title" className="text-lg font-bold text-ui-primary">{isExistingRecipe ? 'Edit Recipe' : 'New Recipe'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-ui-soft-2 rounded-full"><X size={18} /></button>
        </div>

        <label className="block text-xs font-bold text-ui-muted uppercase mb-1">Recipe Name</label>
        <input
          className="w-full border border-ui rounded-xl px-3 py-2 mb-4 text-sm"
          placeholder="e.g. Spaghetti Bolognese"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <label className="block text-xs font-bold text-ui-muted uppercase mb-2">Ingredients</label>
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 border border-ui rounded-xl px-3 py-2 text-sm"
                placeholder={`Ingredient ${i + 1}`}
                value={ing}
                onChange={e => updateIngredient(i, e.target.value)}
              />
              {ingredients.length > 1 && (
                <button onClick={() => removeIngredient(i)} className="p-2 text-ui-muted-2 hover:text-rose-500">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addIngredient} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-semibold mb-6">
          <Plus size={14} /> Add ingredient
        </button>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-ui-muted uppercase mb-1">Servings</span>
            <input className="w-full border border-ui rounded-xl px-3 py-2 text-sm" inputMode="numeric" value={servings} onChange={e => setServings(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-ui-muted uppercase mb-1">Prep</span>
            <input className="w-full border border-ui rounded-xl px-3 py-2 text-sm" inputMode="numeric" value={prepTimeMinutes} onChange={e => setPrepTimeMinutes(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-ui-muted uppercase mb-1">Cook</span>
            <input className="w-full border border-ui rounded-xl px-3 py-2 text-sm" inputMode="numeric" value={cookTimeMinutes} onChange={e => setCookTimeMinutes(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>

        <label className="block text-xs font-bold text-ui-muted uppercase mb-1">Instructions</label>
        <textarea className="w-full border border-ui rounded-xl px-3 py-2 mb-3 text-sm min-h-24" value={instructions} onChange={e => setInstructions(e.target.value)} />

        <label className="block text-xs font-bold text-ui-muted uppercase mb-1">Notes</label>
        <textarea className="w-full border border-ui rounded-xl px-3 py-2 mb-3 text-sm min-h-16" value={notes} onChange={e => setNotes(e.target.value)} />

        <label className="block text-xs font-bold text-ui-muted uppercase mb-1">Source URL</label>
        <input className="w-full border border-ui rounded-xl px-3 py-2 mb-3 text-sm" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />

        <label className="block text-xs font-bold text-ui-muted uppercase mb-1">Image URL</label>
        <input className="w-full border border-ui rounded-xl px-3 py-2 mb-3 text-sm" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />

        <label className="flex items-center gap-2 text-sm font-semibold text-ui-secondary mb-6">
          <input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} />
          Favorite
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-ui-soft-2 rounded-xl text-sm font-semibold text-ui-secondary hover:bg-ui-soft-3">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-50">
            {saving ? 'Saving...' : isExistingRecipe ? 'Save Changes' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}

