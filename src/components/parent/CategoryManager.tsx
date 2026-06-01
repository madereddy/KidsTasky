import { categoryService } from '../../services/categories';
import React, { useState } from 'react';
import { LogOut, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Category } from '../../types';
import { cn } from '../../lib/utils';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../constants';

export function CategoryManager({ 
  parentId, 
  categories, 
  onClose,
  onUpdate 
}: { 
  parentId: string, 
  categories: Category[], 
  onClose: () => void,
  onUpdate: (cats: Category[]) => void 
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0].class);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    if (editingId) {
      await categoryService.updateCategory({ id: editingId, name, icon, color, parentId });
    } else {
      await categoryService.createCategory({ name, icon, color, parentId });
    }
    
    const updated = await categoryService.getCategories(parentId);
    onUpdate(updated || []);
    setName('');
    setEditingId(null);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
  };

  const handleDelete = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this category?')) return;
    await categoryService.deleteCategory(id);
    const updated = await categoryService.getCategories(parentId);
    onUpdate(updated || []);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ui-soft-80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white shadow-sm border border-ui-soft w-full max-w-md rounded-[40px] p-10 shadow-2xl border-blue-500/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-black italic tracking-tighter uppercase">Categories</h3>
          <button onClick={onClose} className="p-2 text-ui-muted hover:text-ui-primary"><LogOut className="w-5 h-5 rotate-180" /></button>
        </div>

        <div className="space-y-6 mb-10 pb-10 border-b border-ui">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Category Name</label>
            <input 
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="input-immersive"
              placeholder="e.g. Chores, School..."
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all",
                    icon === i ? "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-110" : "bg-white shadow-sm border border-ui-dark text-ui-muted"
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Color Accent</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map(c => (
                <button
                  key={c.class}
                  onClick={() => setColor(c.class)}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all border-2",
                    c.class,
                    color === c.class ? "border-white scale-110" : "border-transparent"
                  )}
                />
              ))}
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            className="w-full btn-immersive-primary bg-blue-600"
          >
            {editingId ? 'Update Category' : 'Create Category'}
          </button>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Existing Categories</label>
          {categories.map(cat => (
            <div key={cat.id} className="flex justify-between items-center bg-white/90 p-3 rounded-2xl border border-ui-dark">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl", cat.color)}>
                  {cat.icon}
                </div>
                <span className="font-bold text-sm tracking-tight">{cat.name}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => startEdit(cat)}
                  className="p-2 text-ui-muted hover:text-blue-400"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="p-2 text-ui-muted hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-center py-4 text-ui-secondary italic text-sm">No categories defined yet.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}


