import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isBefore, startOfDay } from 'date-fns';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Homework, UserProfile } from '../../types';
import { homeworkClientService } from '../../services/homework';
import { AddHomeworkModal } from './AddHomeworkModal';

interface Props {
  parentId: string;
  kids: UserProfile[];
  userRole: 'parent' | 'kid';
  currentUserId?: string;
}

export function HomeworkView({ parentId, kids, userRole, currentUserId }: Props) {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [proofPrompt, setProofPrompt] = useState<{ item: Homework; questions: string[] } | null>(null);
  const [proofAnswers, setProofAnswers] = useState<Record<string, string>>({});
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [celebrationTick, setCelebrationTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await homeworkClientService.getHomework(parentId);
      setHomework(rows || []);
    } catch {
      setLoadError('Could not load homework right now.');
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => { load(); }, [load]);

  const visibleHomework = useMemo(() => {
    if (userRole === 'parent') return homework;
    return homework.filter((item) => !item.assignedToId || item.assignedToId === currentUserId);
  }, [homework, userRole, currentUserId]);

  const getActiveQuestions = (item: Homework): string[] => {
    const questions = Array.isArray(item.completionQuestions) ? item.completionQuestions.filter(Boolean) : [];
    if (questions.length === 0) return [];
    if (!item.completionQuestionsKidId) return questions;
    return item.completionQuestionsKidId === currentUserId ? questions : [];
  };

  const buildHomeworkResponse = (questions: string[]) =>
    questions
      .map((q, i) => ({ question: q, answer: String(proofAnswers[`q_${i}`] || '').trim() }))
      .filter((pair) => pair.answer.length > 0)
      .map((pair) => `${pair.question} ${pair.answer}`)
      .join('\n');

  return (
    <div className="rounded-2xl border border-ui bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ui-primary">Homework</h2>
          {userRole === 'kid' && <p className="text-xs text-ui-muted">Quick Update</p>}
        </div>
        {userRole === 'parent' && (
          <button onClick={() => setShowAdd(true)} className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold flex items-center gap-1.5">
            <Plus size={14} /> Add
          </button>
        )}
      </div>
      <div className="space-y-2">
        {loading && <p className="text-sm text-ui-muted">Loading homework...</p>}
        {!loading && loadError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-rose-700">{loadError}</p>
            <button onClick={() => void load()} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold">Retry</button>
          </div>
        )}
        {visibleHomework.map((item) => {
          const isOverdue = item.status !== 'done' && isBefore(new Date(item.dueDate), startOfDay(new Date()));
          const assignee = item.assignedToId ? kids.find((kid) => kid.uid === item.assignedToId)?.name || 'Assigned' : 'All kids';
          return (
            <div key={item.id} className={`border rounded-xl p-3 flex items-center justify-between gap-3 ${userRole === 'kid' ? 'border-2 border-ui-soft shadow-sm bg-white' : 'border-ui'}`}>
              <div>
                <p className="font-semibold text-ui-primary">{item.title}</p>
                <p className="text-xs text-ui-muted">
                  {item.subject} • Due {format(new Date(item.dueDate), 'MMM d, yyyy')} • {assignee}
                  {item.recurrence && item.recurrence !== 'none' ? ` • Repeats: ${item.recurrence === 'weekdays' ? 'weekdays' : 'daily'}` : ''}
                </p>
                {isOverdue && <p className="text-xs text-rose-600 font-semibold">Overdue</p>}
                {item.completionResponse && (
                  <p className="text-xs text-ui-secondary mt-1 whitespace-pre-line">{item.completionResponse}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const nextStatus = item.status === 'done' ? 'pending' : 'done';
                      const questions = nextStatus === 'done' && userRole === 'kid' ? getActiveQuestions(item) : [];
                      if (questions.length > 0 && nextStatus === 'done') {
                        setProofAnswers({});
                        setProofPrompt({ item, questions });
                        return;
                      }
                      setActionId(item.id);
                      await homeworkClientService.updateHomework(item.id, {
                        status: nextStatus,
                        completionResponse: nextStatus === 'pending' ? null : item.completionResponse ?? null
                      });
                      if (nextStatus === 'done') setCelebrationTick((n) => n + 1);
                      await load();
                    } finally {
                      setActionId(null);
                    }
                  }}
                  disabled={actionId === item.id}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${item.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-ui-soft-2 text-ui-secondary'}`}
                >
                  {actionId === item.id ? 'Saving...' : (item.status === 'done' ? 'Undo' : 'Mark done')}
                </button>
                {userRole === 'parent' && (
                  <>
                    <button
                      onClick={() => setEditingHomework(item)}
                      disabled={actionId === item.id}
                      className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                      aria-label={`Edit homework ${item.title}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this homework item?')) return;
                        try {
                          setActionId(item.id);
                          await homeworkClientService.deleteHomework(item.id);
                          await load();
                        } finally {
                          setActionId(null);
                        }
                      }}
                      disabled={actionId === item.id}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {visibleHomework.length === 0 && <p className="text-sm text-ui-muted">No homework yet.</p>}
      </div>
      {showAdd && userRole === 'parent' && (
        <AddHomeworkModal
          kids={kids}
          onClose={() => setShowAdd(false)}
          onSubmit={async (payload) => {
            await homeworkClientService.createHomework({ ...payload, parentId, status: 'pending' });
            await load();
          }}
        />
      )}
      {editingHomework && userRole === 'parent' && (
        <AddHomeworkModal
          kids={kids}
          titleLabel="Edit Homework"
          submitLabel="Save"
          initialValues={{
            title: editingHomework.title,
            subject: editingHomework.subject,
            notes: editingHomework.notes,
            dueDate: editingHomework.dueDate,
            assignedToId: editingHomework.assignedToId,
            color: editingHomework.color,
            recurrence: editingHomework.recurrence || 'none',
            completionQuestions: editingHomework.completionQuestions || [],
            completionQuestionsKidId: editingHomework.completionQuestionsKidId || null,
          }}
          onClose={() => setEditingHomework(null)}
          onSubmit={async (payload) => {
            await homeworkClientService.updateHomework(editingHomework.id, payload);
            await load();
            setEditingHomework(null);
          }}
        />
      )}
      {proofPrompt && (
        <div className="fixed inset-0 bg-ui-deep-80 z-50 flex items-center justify-center p-4" onClick={() => setProofPrompt(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-ui p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-ui-primary">Homework Follow-up</h3>
            {proofPrompt.questions.map((q, i) => (
              <div key={`proof-q-${i}`}>
                <label className="block text-xs text-ui-muted mb-1">{q}</label>
                <input
                  className="w-full border border-ui rounded-lg px-3 py-2 text-sm"
                  value={proofAnswers[`q_${i}`] || ''}
                  onChange={(e) => setProofAnswers((prev) => ({ ...prev, [`q_${i}`]: e.target.value }))}
                  placeholder="Your answer"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setProofPrompt(null)} className="flex-1 py-2 rounded-xl bg-ui-soft-2 text-ui-secondary font-semibold">Cancel</button>
              <button
                onClick={async () => {
                  const response = buildHomeworkResponse(proofPrompt.questions);
                  if (!response.trim()) return;
                  setActionId(proofPrompt.item.id);
                  try {
                    await homeworkClientService.updateHomework(proofPrompt.item.id, { status: 'done', completionResponse: response });
                    setCelebrationTick((n) => n + 1);
                    setProofPrompt(null);
                    setProofAnswers({});
                    await load();
                  } finally {
                    setActionId(null);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {celebrationTick > 0 && (
          <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden" key={`hw-celebrate-${celebrationTick}`}>
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.div
                key={`hw-confetti-${celebrationTick}-${i}`}
                initial={{ opacity: 1, y: 70, x: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -220 - (i % 4) * 24, x: (i % 2 === 0 ? 1 : -1) * (30 + i * 7), rotate: (i % 2 === 0 ? 1 : -1) * (50 + i * 8), scale: 1.1 }}
                transition={{ duration: 1, ease: 'easeOut', delay: (i % 5) * 0.03 }}
                className="absolute left-1/2 bottom-20 text-2xl"
              >
                {i % 2 === 0 ? '🎉' : '✨'}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
