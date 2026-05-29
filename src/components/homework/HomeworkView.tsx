import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isBefore, startOfDay } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
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
  const [actionId, setActionId] = useState<string | null>(null);
  const [proofPrompt, setProofPrompt] = useState<{ item: Homework; questions: string[] } | null>(null);
  const [proofAnswers, setProofAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await homeworkClientService.getHomework(parentId);
      setHomework(rows || []);
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
        <h2 className="text-lg font-bold text-ui-primary">Homework</h2>
        {userRole === 'parent' && (
          <button onClick={() => setShowAdd(true)} className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold flex items-center gap-1.5">
            <Plus size={14} /> Add
          </button>
        )}
      </div>
      <div className="space-y-2">
        {loading && <p className="text-sm text-ui-muted">Loading homework...</p>}
        {visibleHomework.map((item) => {
          const isOverdue = item.status !== 'done' && isBefore(new Date(item.dueDate), startOfDay(new Date()));
          const assignee = item.assignedToId ? kids.find((kid) => kid.uid === item.assignedToId)?.name || 'Assigned' : 'All kids';
          return (
            <div key={item.id} className="border border-ui rounded-xl p-3 flex items-center justify-between gap-3">
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
                      await load();
                    } finally {
                      setActionId(null);
                    }
                  }}
                  disabled={actionId === item.id}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${item.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-ui-soft-2 text-ui-secondary'}`}
                >
                  {actionId === item.id ? 'Saving...' : (item.status === 'done' ? 'Done' : 'Mark done')}
                </button>
                {userRole === 'parent' && (
                  <button
                    onClick={async () => {
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
    </div>
  );
}
