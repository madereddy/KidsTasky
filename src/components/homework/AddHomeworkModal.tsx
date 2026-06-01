import React, { useMemo, useRef, useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { cn } from '../../lib/utils';
import { proofTemplatesClientService, ProofTemplate } from '../../services/proofTemplates';

const HOMEWORK_RESPONSE_TEMPLATES: Array<{ name: string; questions: string[] }> = [
  {
    name: 'Workbook',
    questions: ['Which workbook did you use?', 'What pages did you complete?'],
  },
  {
    name: 'Reading',
    questions: ['What did you read today?', 'How many pages or minutes did you complete?'],
  },
  {
    name: 'Math Practice',
    questions: ['Which lesson or topic did you do?', 'How many problems did you finish?'],
  },
];

interface Props {
  kids: UserProfile[];
  onClose: () => void;
  initialValues?: {
    title: string;
    subject: string;
    notes?: string;
    dueDate: string;
    assignedToId?: string;
    color: string;
    completionQuestions?: string[];
    completionQuestionsKidId?: string | null;
    recurrence?: 'none' | 'daily' | 'weekdays';
  };
  titleLabel?: string;
  submitLabel?: string;
  onSubmit: (payload: {
    title: string;
    subject: string;
    notes?: string;
    dueDate: string;
    assignedToId?: string;
    color: string;
    completionQuestions?: string[];
    completionQuestionsKidId?: string | null;
    recurrence?: 'none' | 'daily' | 'weekdays';
  }) => Promise<void>;
}

export function AddHomeworkModal({ kids, onClose, onSubmit, initialValues, titleLabel, submitLabel }: Props) {
  const storageKey = 'kidtasky:last-homework-defaults';
  const { dialogRef, onKeyDown } = useDialogA11y(true, onClose);
  const [title, setTitle] = useState(initialValues?.title || '');
  const [subject, setSubject] = useState(initialValues?.subject || '');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [dueDate, setDueDate] = useState(initialValues?.dueDate || '');
  const [assignedToId, setAssignedToId] = useState(initialValues?.assignedToId || '');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekdays'>(initialValues?.recurrence || 'none');
  const [color, setColor] = useState(initialValues?.color || '#6366f1');
  const [completionQuestionsText, setCompletionQuestionsText] = useState(Array.isArray(initialValues?.completionQuestions) ? initialValues!.completionQuestions!.join('\n') : '');
  const [completionQuestionsKidId, setCompletionQuestionsKidId] = useState(initialValues?.completionQuestionsKidId || '');
  const [templateName, setTemplateName] = useState('');
  const [templateApplyMode, setTemplateApplyMode] = useState<'append' | 'replace'>('append');
  const [customTemplates, setCustomTemplates] = useState<ProofTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const sortedCustomTemplates = useMemo(
    () => [...customTemplates].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name)),
    [customTemplates]
  );
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const rows = await proofTemplatesClientService.list('homework');
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
    await proofTemplatesClientService.upsert('homework', { name, questions, pinned: false });
    await loadTemplates();
    setTemplateName('');
    })();
  };
  const deleteCustomTemplate = (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this template?')) return;
    void (async () => {
      await proofTemplatesClientService.remove('homework', id);
      await loadTemplates();
    })();
  };
  const togglePinnedTemplate = (id: string, pinned: boolean) => {
    void (async () => {
      await proofTemplatesClientService.setPinned('homework', id, !pinned);
      await loadTemplates();
    })();
  };
  const exportTemplates = () => {
    const payload = sortedCustomTemplates.map((t) => ({ name: t.name, questions: t.questions, pinned: t.pinned }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kidtasky-homework-proof-templates.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importTemplates = async (file: File) => {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    await proofTemplatesClientService.import('homework', parsed);
    await loadTemplates();
  };
  useEffect(() => {
    if (initialValues) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const last = JSON.parse(raw) as { subject?: string; assignedToId?: string; recurrence?: 'none' | 'daily' | 'weekdays'; color?: string };
      if (last.subject) setSubject(last.subject);
      if (last.assignedToId) setAssignedToId(last.assignedToId);
      if (last.recurrence) setRecurrence(last.recurrence);
      if (last.color) setColor(last.color);
    } catch {}
  }, [initialValues]);

  const submit = async () => {
    if (!title || !subject || !dueDate) return;
    await onSubmit({
      title,
      subject,
      notes: notes || undefined,
      dueDate,
      assignedToId: assignedToId || undefined,
      color,
      recurrence,
      completionQuestions: completionQuestionsText.split('\n').map((line) => line.trim()).filter(Boolean),
      completionQuestionsKidId: completionQuestionsKidId || null,
    });
    if (!initialValues) {
      localStorage.setItem(storageKey, JSON.stringify({ subject, assignedToId, recurrence, color }));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-ui-deep-80 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-homework-title" tabIndex={-1} onKeyDown={async (e) => {
        onKeyDown(e);
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          await submit();
        }
      }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl border border-ui p-5 space-y-3 my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h3 id="add-homework-title" className="text-lg font-bold text-ui-primary">{titleLabel || 'Add Homework'}</h3>
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="w-full border border-ui rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <select className="w-full border border-ui rounded-lg px-3 py-2 text-sm" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
          <option value="">All kids</option>
          {kids.map((kid) => <option key={kid.uid} value={kid.uid}>{kid.name}</option>)}
        </select>
        <div>
          <label className="block text-xs font-semibold text-ui-secondary mb-1">Repeats</label>
          <select className="w-full border border-ui rounded-lg px-3 py-2 text-sm" value={recurrence} onChange={(e) => setRecurrence(e.target.value as any)}>
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Every weekday (Mon-Fri)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-ui-secondary">Verification (Optional)</label>
          <p className="text-[11px] text-ui-muted">Kid answers these when marking homework done.</p>
        </div>
        <textarea
          className="w-full border border-ui rounded-lg px-3 py-2 text-sm"
          rows={3}
          placeholder={"Optional completion questions (one per line)\nExample: Which workbook did you use?\nWhat pages did you complete?"}
          value={completionQuestionsText}
          onChange={(e) => setCompletionQuestionsText(e.target.value)}
        />
        <div className="flex items-center gap-2 -mt-1">
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
        <div className="flex flex-wrap gap-2">
          {HOMEWORK_RESPONSE_TEMPLATES.map((tpl) => (
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
        <div className="flex items-center gap-2">
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
          <div className="flex flex-wrap gap-2">
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
        <div className="flex gap-2">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full border border-ui rounded-lg px-3 py-2 text-sm"
            placeholder="Save as template name"
          />
          <button
            type="button"
            onClick={saveCustomTemplate}
            className="px-3 py-2 rounded-lg border border-ui text-xs font-semibold text-ui-secondary hover:bg-ui-soft"
          >
            {submitLabel || 'Save'}
          </button>
        </div>
        <select className="w-full border border-ui rounded-lg px-3 py-2 text-sm" value={completionQuestionsKidId} onChange={(e) => setCompletionQuestionsKidId(e.target.value)}>
          <option value="">Ask whichever kid marks it done</option>
          {kids.map((kid) => <option key={kid.uid} value={kid.uid}>{kid.name}</option>)}
        </select>
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-ui-soft-2 text-ui-secondary font-semibold">Cancel</button>
          <button
            onClick={submit}
            className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
