import React, { useMemo, useRef, useState, useEffect } from 'react';
import { CheckCircle2, Clock, Plus, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, UserProfile, Category, TaskFrequency, TaskDifficulty } from '../../types';
import { cn } from '../../lib/utils';
import { proofTemplatesClientService, ProofTemplate } from '../../services/proofTemplates';

const TASK_PROOF_TEMPLATES: Array<{ name: string; questions: string[] }> = [
  {
    name: 'Room Cleanup',
    questions: ['Are all clothes in the hamper?', 'Is the floor clean?', 'Did you make the bed?'],
  },
  {
    name: 'Kitchen Help',
    questions: ['Did you clear your plate?', 'Did you wipe the table?', 'Did you put dishes away?'],
  },
  {
    name: 'Morning Routine',
    questions: ['Did you brush teeth?', 'Did you get dressed?', 'Did you pack your bag?'],
  },
];

export function AddTaskModal({ onClose, onSubmit, kids, parentId, categories, existingTasks, initialTask, modalTitle, submitLabel, allowMultiAssign = true }: { 
  onClose: () => void, 
  onSubmit: (t: any) => Promise<void> | void,
  kids: UserProfile[],
  parentId: string,
  categories: Category[],
  existingTasks: Task[],
  initialTask?: Task,
  modalTitle?: string,
  submitLabel?: string,
  allowMultiAssign?: boolean
}) {
  const storageKey = 'kidtasky:last-task-defaults';
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<TaskFrequency>('daily');
  const [customInterval, setCustomInterval] = useState(3);
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('easy');
  const [assignmentMode, setAssignmentMode] = useState<'specific' | 'all'>('specific');
  const [assignedKidIds, setAssignedKidIds] = useState<string[]>(kids[0]?.uid ? [kids[0].uid] : []);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [categoryId, setCategoryId] = useState<string>('');
  const [prerequisiteTaskIds, setPrerequisiteTaskIds] = useState<string[]>([]);
  const [starValue, setStarValue] = useState(1);
  const [completionQuestionsText, setCompletionQuestionsText] = useState('');
  const [completionQuestionsKidId, setCompletionQuestionsKidId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [customTemplates, setCustomTemplates] = useState<ProofTemplate[]>([]);
  const [templateApplyMode, setTemplateApplyMode] = useState<'append' | 'replace'>('append');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialTask) return;
    setTitle(initialTask.title || '');
    setFrequency(initialTask.frequency || 'daily');
    setCustomInterval(initialTask.customInterval || 3);
    setDifficulty(initialTask.difficulty || 'easy');
    setAssignmentMode(initialTask.assignedKidId === 'all' ? 'all' : 'specific');
    setAssignedKidIds(initialTask.assignedKidId === 'all' ? [] : [initialTask.assignedKidId]);
    setReminderTime(initialTask.reminderTime || '08:00');
    setCategoryId(initialTask.categoryId || '');
    setPrerequisiteTaskIds(Array.isArray(initialTask.prerequisiteTaskIds) ? initialTask.prerequisiteTaskIds : []);
    setStarValue(initialTask.starValue ?? 1);
    setCompletionQuestionsText(Array.isArray(initialTask.completionQuestions) ? initialTask.completionQuestions.join('\n') : '');
    setCompletionQuestionsKidId(initialTask.completionQuestionsKidId || '');
  }, [initialTask]);
  useEffect(() => {
    if (initialTask) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const last = JSON.parse(raw) as { frequency?: TaskFrequency; difficulty?: TaskDifficulty; reminderTime?: string; categoryId?: string; assignmentMode?: 'specific' | 'all'; assignedKidIds?: string[] };
      if (last.frequency) setFrequency(last.frequency);
      if (last.difficulty) setDifficulty(last.difficulty);
      if (last.reminderTime) setReminderTime(last.reminderTime);
      if (last.categoryId !== undefined) setCategoryId(last.categoryId);
      if (last.assignmentMode) setAssignmentMode(last.assignmentMode);
      if (Array.isArray(last.assignedKidIds)) setAssignedKidIds(last.assignedKidIds);
    } catch {}
  }, [initialTask]);

  const submit = async () => {
    if (assignmentMode === 'specific' && assignedKidIds.length === 0) return;
    const payload = {
      title,
      frequency,
      difficulty,
      assignedKidId: assignmentMode === 'all' ? 'all' : (assignedKidIds[0] || ''),
      assignedKidIds: assignmentMode === 'specific' ? assignedKidIds : undefined,
      reminderTime,
      parentId,
      categoryId,
      customInterval: frequency === 'custom' ? customInterval : undefined,
      prerequisiteTaskIds: prerequisiteTaskIds.length > 0 ? prerequisiteTaskIds : undefined,
      starValue,
      requiresApproval: true,
      completionQuestions: completionQuestionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      completionQuestionsKidId: completionQuestionsKidId || null,
    };
    if (!initialTask) {
      localStorage.setItem(storageKey, JSON.stringify({
        frequency,
        difficulty,
        reminderTime,
        categoryId,
        assignmentMode,
        assignedKidIds,
      }));
    }
    await onSubmit(payload);
    onClose();
  };

  const togglePrereq = (id: string) => {
    if (prerequisiteTaskIds.includes(id)) {
      setPrerequisiteTaskIds(prerequisiteTaskIds.filter((pid: string) => pid !== id));
    } else {
      setPrerequisiteTaskIds([...prerequisiteTaskIds, id]);
    }
  };

  const primaryAssignedKidId = assignmentMode === 'all' ? 'all' : (assignedKidIds[0] || '');
  const eligiblePrereqs = existingTasks.filter((t) => t.assignedKidId === primaryAssignedKidId || (primaryAssignedKidId === 'all' && t.assignedKidId === 'all'));
  const sortedCustomTemplates = useMemo(
    () => [...customTemplates].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name)),
    [customTemplates]
  );

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const rows = await proofTemplatesClientService.list('task');
      setCustomTemplates(rows || []);
    } finally {
      setLoadingTemplates(false);
    }
  };
  useEffect(() => { void loadTemplates(); }, []);

  const applyTemplate = (questions: string[]) => {
    const next = questions.join('\n');
    if (templateApplyMode === 'replace') {
      setCompletionQuestionsText(next);
      return;
    }
    setCompletionQuestionsText((prev) => (prev.trim() ? `${prev.trim()}\n${next}` : next));
  };
  const saveCustomTemplate = () => {
    void (async () => {
    const name = templateName.trim();
    const questions = completionQuestionsText.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!name || questions.length === 0) return;
    await proofTemplatesClientService.upsert('task', { name, questions, pinned: false });
    await loadTemplates();
    setTemplateName('');
    })();
  };
  const deleteCustomTemplate = (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this template?')) return;
    void (async () => {
      await proofTemplatesClientService.remove('task', id);
      await loadTemplates();
    })();
  };
  const togglePinnedTemplate = (id: string, pinned: boolean) => {
    void (async () => {
      await proofTemplatesClientService.setPinned('task', id, !pinned);
      await loadTemplates();
    })();
  };
  const exportTemplates = () => {
    const payload = sortedCustomTemplates.map((t) => ({ name: t.name, questions: t.questions, pinned: t.pinned }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kidtasky-task-proof-templates.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importTemplates = async (file: File) => {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    await proofTemplatesClientService.import('task', parsed);
    await loadTemplates();
  };
  const toggleKidSelection = (kidId: string) => {
    setAssignedKidIds((prev) => {
      if (allowMultiAssign === false) return [kidId];
      return prev.includes(kidId) ? prev.filter((id) => id !== kidId) : [...prev, kidId];
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ui-soft-80 backdrop-blur-md"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          submit();
        }
      }}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white shadow-sm border border-ui-soft w-full max-w-sm rounded-[40px] p-10 shadow-2xl border-blue-500/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-8">{modalTitle || 'New Mission'}</h3>
        
        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block">Mission Objective</label>
            <input 
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              className="input-immersive"
              placeholder="e.g. Navigation Check"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block">Mission Category</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setCategoryId('')}
                className={cn(
                  "py-2 rounded-xl font-bold text-xs uppercase border transition-all min-h-[44px]",
                  categoryId === '' ? "bg-ui-dark-2 text-ui-primary border-ui-dark-2" : "bg-white shadow-sm border-ui text-ui-muted"
                )}
              >
                None
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-xs uppercase border transition-all flex flex-col items-center justify-center gap-1 min-h-[44px]",
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
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-1 block">Repeats</label>
            <p className="text-[11px] text-ui-muted mb-2">Choose when this task should automatically show up.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(['daily', 'weekdays', 'twice-daily', 'weekly', 'bi-weekly', 'custom'] as TaskFrequency[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-xs uppercase border transition-all min-h-[44px]",
                    frequency === f ? "bg-blue-600 text-white border-blue-500 glow-blue shadow-lg" : "bg-ui-dark border-ui-dark text-ui-muted"
                  )}
                >
                  {f === 'weekdays' ? 'weekdays' : f.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'custom' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block">Interval Days</label>
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
              <p className="text-xs text-ui-muted italic mt-1 uppercase tracking-tight">Mission resets every {customInterval} days</p>
            </motion.div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block">Mission Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as TaskDifficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-xs uppercase border transition-all min-h-[44px]",
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
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block">Assign to Cadet</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setAssignmentMode('specific')}
                className={cn(
                  "py-2 rounded-xl font-bold text-xs uppercase border transition-all min-h-[44px]",
                  assignmentMode === 'specific' ? "bg-blue-600 text-white border-blue-500" : "bg-ui-dark border-ui-dark text-ui-muted"
                )}
              >
                Specific Kids
              </button>
              <button
                type="button"
                onClick={() => setAssignmentMode('all')}
                className={cn(
                  "py-2 rounded-xl font-bold text-xs uppercase border transition-all min-h-[44px]",
                  assignmentMode === 'all' ? "bg-fuchsia-600 text-white border-fuchsia-500" : "bg-ui-dark border-ui-dark text-ui-muted"
                )}
              >
                Up for Grabs
              </button>
            </div>
            {assignmentMode === 'specific' ? (
              <div className="space-y-2">
                {kids.map((kid) => (
                  <label key={kid.uid} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-ui cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignedKidIds.includes(kid.uid)}
                      onChange={() => toggleKidSelection(kid.uid)}
                    />
                    <span className="text-sm font-medium text-ui-primary">{kid.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ui-muted">Any kid can claim and complete this task.</p>
            )}
          </div>

          {eligiblePrereqs.length > 0 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block flex items-center gap-1">
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
                        : "bg-white/90 text-ui-muted border-ui-dark hover:border-ui"
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
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block">⭐ Star Value</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStarValue(n)}
                  className={cn(
                    'w-10 h-10 rounded-full font-bold text-sm border-2 transition-all',
                    starValue === n ? 'bg-amber-500 border-amber-600 text-white shadow-md' : 'bg-white border-ui text-ui-muted hover:border-amber-300'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-ui-muted mt-1">Stars kids earn for completing this task</p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-1 block">Verification (Optional)</label>
            <p className="text-[11px] text-ui-muted mb-2">Kids answer these when marking complete.</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-ui-muted">Template mode:</span>
              <button
                type="button"
                onClick={() => setTemplateApplyMode('append')}
                className={cn("px-2 py-1 rounded text-xs border", templateApplyMode === 'append' ? "bg-blue-500 text-white border-blue-500" : "border-ui text-ui-secondary")}
              >
                Append
              </button>
              <button
                type="button"
                onClick={() => setTemplateApplyMode('replace')}
                className={cn("px-2 py-1 rounded text-xs border", templateApplyMode === 'replace' ? "bg-blue-500 text-white border-blue-500" : "border-ui text-ui-secondary")}
              >
                Replace
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {TASK_PROOF_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => applyTemplate(tpl.questions)}
                  className="px-2 py-1 rounded-lg border border-ui text-xs text-ui-secondary hover:bg-ui-soft"
                >
                  + {tpl.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={exportTemplates} className="px-2 py-1 rounded-lg border border-ui text-xs text-ui-secondary hover:bg-ui-soft">
                Export JSON
              </button>
              <button type="button" onClick={() => importRef.current?.click()} className="px-2 py-1 rounded-lg border border-ui text-xs text-ui-secondary hover:bg-ui-soft">
                Import JSON
              </button>
              {loadingTemplates && <span className="text-xs text-ui-muted">Loading...</span>}
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importTemplates(file);
                  e.currentTarget.value = '';
                }}
              />
            </div>
            {sortedCustomTemplates.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {sortedCustomTemplates.map((tpl) => (
                  <div key={tpl.id} className="inline-flex items-center rounded-lg border border-ui overflow-hidden">
                    <button
                      type="button"
                      onClick={() => applyTemplate(tpl.questions)}
                      className="px-2 py-1 text-xs text-ui-secondary hover:bg-ui-soft"
                    >
                      + {tpl.pinned ? '★ ' : ''}{tpl.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePinnedTemplate(tpl.id, tpl.pinned)}
                      className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 border-l border-ui"
                      title={tpl.pinned ? 'Unpin' : 'Pin'}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCustomTemplate(tpl.id)}
                      className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border-l border-ui"
                      title={`Delete ${tpl.name}`}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={completionQuestionsText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCompletionQuestionsText(e.target.value)}
              className="input-immersive min-h-[90px]"
              placeholder={"One question per line.\nExample:\nAre clothes in the hamper?\nIs the floor clean?"}
            />
            <div className="flex gap-2 mt-2">
              <input
                value={templateName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplateName(e.target.value)}
                className="input-immersive"
                placeholder="Save as template name"
              />
              <button
                type="button"
                onClick={saveCustomTemplate}
                className="px-3 py-2 rounded-lg border border-ui text-xs font-semibold text-ui-secondary hover:bg-ui-soft"
              >
                Save
              </button>
            </div>
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block mt-3">Ask Only This Kid (Optional)</label>
            <select
              value={completionQuestionsKidId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCompletionQuestionsKidId(e.target.value)}
              className="input-immersive"
            >
              <option value="">Whoever completes the task</option>
              {kids.map((kid) => (
                <option key={kid.uid} value={kid.uid}>{kid.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-2 block">Launch Time</label>
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
              onClick={submit}
              disabled={assignmentMode === 'specific' && assignedKidIds.length === 0}
              className="flex-1 btn-immersive-primary bg-blue-600"
            >
              {submitLabel || 'Launch'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


