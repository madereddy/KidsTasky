import React, { useState } from 'react';
import { CheckCircle2, Clock, Plus, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, UserProfile, Category, TaskFrequency, TaskDifficulty } from '../types';
import { cn } from '../lib/utils';

export function AddTaskModal({ onClose, onSubmit, kids, parentId, categories, existingTasks }: { 
  onClose: () => void, 
  onSubmit: (t: any) => void, 
  kids: UserProfile[],
  parentId: string,
  categories: Category[],
  existingTasks: Task[]
}) {
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<TaskFrequency>('daily');
  const [customInterval, setCustomInterval] = useState(3);
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('easy');
  const [assignedKidId, setAssignedKidId] = useState(kids[0]?.uid || '');
  const [reminderTime, setReminderTime] = useState('08:00');
  const [categoryId, setCategoryId] = useState<string>('');
  const [prerequisiteTaskIds, setPrerequisiteTaskIds] = useState<string[]>([]);

  const togglePrereq = (id: string) => {
    if (prerequisiteTaskIds.includes(id)) {
      setPrerequisiteTaskIds(prerequisiteTaskIds.filter((pid: string) => pid !== id));
    } else {
      setPrerequisiteTaskIds([...prerequisiteTaskIds, id]);
    }
  };

  const eligiblePrereqs = existingTasks.filter(t => t.assignedKidId === assignedKidId);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ui-deep-80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-sm rounded-[40px] p-10 shadow-2xl border-blue-500/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-8">New Mission</h3>
        
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Mission Objective</label>
            <input 
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              className="input-immersive"
              placeholder="e.g. Navigation Check"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Mission Category</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setCategoryId('')}
                className={cn(
                  "py-2 rounded-xl font-bold text-[10px] uppercase border transition-all",
                  categoryId === '' ? "bg-ui-dark-2 text-white border-ui-dark-2" : "bg-ui-dark border-ui-dark text-ui-muted"
                )}
              >
                None
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-[10px] uppercase border transition-all flex flex-col items-center justify-center gap-1",
                    categoryId === cat.id ? cn(cat.color, "text-white border-white/20 glow-blue") : "bg-ui-dark border-ui-dark text-ui-muted"
                  )}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span className="truncate w-full text-center px-1">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Cycle Frequency</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(['daily', 'twice-daily', 'weekly', 'bi-weekly', 'custom'] as TaskFrequency[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-[8px] md:text-[10px] uppercase border transition-all",
                    frequency === f ? "bg-blue-600 text-white border-blue-500 glow-blue shadow-lg" : "bg-ui-dark border-ui-dark text-ui-muted"
                  )}
                >
                  {f.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'custom' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Interval Days</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="2"
                  max="30"
                  value={customInterval}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomInterval(parseInt(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xl font-black text-blue-400 font-mono w-8">{customInterval}</span>
              </div>
              <p className="text-[8px] text-ui-muted italic mt-1 uppercase tracking-tight">Mission resets every {customInterval} days</p>
            </motion.div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Mission Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as TaskDifficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-[10px] uppercase border transition-all",
                    difficulty === d ? cn(
                      d === 'easy' ? "bg-emerald-600 border-emerald-500" : 
                      d === 'medium' ? "bg-amber-600 border-amber-500" : 
                      "bg-rose-600 border-rose-500",
                      "text-white glow-blue"
                    ) : "bg-ui-dark border-ui-dark text-ui-muted"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Assign to Cadet</label>
            <input 
              value={assignedKidId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssignedKidId(e.target.value)}
              className="input-immersive"
              placeholder="Cadet UID"
            />
          </div>

          {eligiblePrereqs.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block flex items-center gap-1">
                <Lock className="w-3 h-3" /> Prerequisites 
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {eligiblePrereqs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => togglePrereq(t.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-xs font-bold border transition-all truncate",
                      prerequisiteTaskIds.includes(t.id) 
                        ? "bg-purple-600/20 text-purple-400 border-purple-500/50" 
                        : "bg-ui-dark-50 text-ui-muted border-ui-dark hover:border-ui-dark-2"
                    )}
                  >
                    {prerequisiteTaskIds.includes(t.id) && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-ui-muted mb-2 block">Launch Time</label>
            <input 
              type="time"
              value={reminderTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReminderTime(e.target.value)}
              className="input-immersive"
            />
          </div>

          <div className="flex gap-3 pt-6">
            <button onClick={onClose} className="flex-1 py-3 bg-ui-dark border border-ui-dark text-ui-muted font-black rounded-xl uppercase tracking-widest text-xs">Abort</button>
            <button 
              onClick={() => onSubmit({ 
                title, 
                frequency, 
                difficulty, 
                assignedKidId, 
                reminderTime, 
                parentId, 
                categoryId,
                customInterval: frequency === 'custom' ? customInterval : undefined,
                prerequisiteTaskIds: prerequisiteTaskIds.length > 0 ? prerequisiteTaskIds : undefined
              })} 
              className="flex-1 btn-immersive-primary bg-blue-600"
            >
              Launch
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


