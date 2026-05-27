import React, { useState } from 'react';
import { X, Plus, Trash2, Clock } from 'lucide-react';
import { RoutineTemplate, UserProfile } from '../../types';
import { routinesClientService } from '../../services/routines';

const PRESET_ROUTINES = [
  { title: 'School Pickup', defaultStartTime: '15:30', color: '#f59e0b', description: 'Pick up from school' },
  { title: 'Trash Day', defaultStartTime: '07:00', color: '#64748b', description: 'Put out trash bins' },
  { title: 'Soccer Practice', defaultStartTime: '17:00', color: '#22c55e', description: 'Weekly soccer practice' },
  { title: 'Homework Time', defaultStartTime: '16:00', color: '#6366f1', description: 'Dedicated homework session' },
];

interface Props {
  parentId: string;
  kids: UserProfile[];
  templates: RoutineTemplate[];
  onClose: () => void;
  onApply: (template: RoutineTemplate) => void;
  onRefresh: () => void;
}

export function RoutineTemplatesModal({ parentId, kids, templates, onClose, onApply, onRefresh }: Props) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newColor, setNewColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localTemplates, setLocalTemplates] = useState<RoutineTemplate[]>(templates);

  React.useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);

  const handleAddPreset = async (preset: typeof PRESET_ROUTINES[0]) => {
    setSaving(true);
    try {
      await routinesClientService.createTemplate(parentId, {
        title: preset.title,
        description: preset.description,
        defaultStartTime: preset.defaultStartTime,
        color: preset.color,
        defaultDuration: 3600000,
      });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNew = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await routinesClientService.createTemplate(parentId, {
        title: newTitle.trim(),
        defaultStartTime: newTime,
        color: newColor,
        defaultDuration: 3600000,
      });
      setNewTitle('');
      setNewTime('09:00');
      setAdding(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await routinesClientService.deleteTemplate(id);
    onRefresh();
  };

  const persistOrder = async (next: RoutineTemplate[]) => {
    setLocalTemplates(next);
    await routinesClientService.reorderTemplates(parentId, next.map((t) => t.id));
    onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ui">
          <h2 className="text-lg font-bold text-ui-primary">Routine Templates</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ui-soft transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {templates.length === 0 && (
            <div>
              <p className="text-sm text-ui-muted mb-3">No routines yet. Add a preset or create your own:</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_ROUTINES.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => handleAddPreset(p)}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-ui bg-ui-soft hover:bg-ui-soft-3 text-sm font-semibold text-ui-secondary transition-colors text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <div className="space-y-2">
              {localTemplates.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDraggingId(t.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (!draggingId || draggingId === t.id) return;
                    const from = localTemplates.findIndex((x) => x.id === draggingId);
                    const to = localTemplates.findIndex((x) => x.id === t.id);
                    if (from < 0 || to < 0) return;
                    const next = [...localTemplates];
                    const [item] = next.splice(from, 1);
                    next.splice(to, 0, item);
                    await persistOrder(next);
                  }}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl border border-ui bg-white"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ui-primary truncate">{t.title}</p>
                    {t.defaultStartTime && (
                      <p className="text-xs text-ui-muted flex items-center gap-1">
                        <Clock size={10} /> {t.defaultStartTime}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onApply(t)}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors min-h-[32px]"
                  >
                    Use
                  </button>
                  <div className="px-2 text-[10px] text-ui-muted font-semibold">Drag</div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded-lg text-ui-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div className="space-y-2 p-3 border border-ui rounded-xl bg-ui-soft">
              <input
                autoFocus
                type="text"
                placeholder="Routine name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-ui text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-ui text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-ui cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNew}
                  disabled={saving || !newTitle.trim()}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="flex-1 py-2 bg-ui-soft border border-ui rounded-lg text-sm font-semibold text-ui-secondary hover:bg-ui-soft-3 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-ui text-sm font-semibold text-ui-muted hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Plus size={16} /> Add Custom Routine
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
