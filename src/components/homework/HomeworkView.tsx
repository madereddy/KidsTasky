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
                <p className="text-xs text-ui-muted">{item.subject} • Due {format(new Date(item.dueDate), 'MMM d, yyyy')} • {assignee}</p>
                {isOverdue && <p className="text-xs text-rose-600 font-semibold">Overdue</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setActionId(item.id);
                      await homeworkClientService.updateHomework(item.id, { status: item.status === 'done' ? 'pending' : 'done' });
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
    </div>
  );
}
