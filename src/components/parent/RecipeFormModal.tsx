import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { mealsClientService } from '../../services/meals';

interface Props {
  parentId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function RecipeFormModal({ parentId, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
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
      await mealsClientService.createRecipe(parentId, name.trim(), filtered);
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-ui-primary">New Recipe</h2>
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
        <div className="space-y-2 mb-3">
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

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-ui-soft-2 rounded-xl text-sm font-semibold text-ui-secondary hover:bg-ui-soft-3">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}

