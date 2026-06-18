import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, RotateCcw, X } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { AppList, EventRoutineItem, CalendarEvent } from '../../types';
import { cn } from '../../lib/utils';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface Props {
  event: CalendarEvent;
  routineLists: AppList[];
  onClose: () => void;
}

export function EventRoutineSheet({ event, routineLists, onClose }: Props) {
  const { dialogRef, onKeyDown } = useDialogA11y(true, onClose);
  const [items, setItems] = useState<EventRoutineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const routine = useMemo(
    () => routineLists.find((entry) => entry.id === event.routineListId) ?? null,
    [event.routineListId, routineLists],
  );

  useEffect(() => {
    if (!event.routineListId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    eventsClientService.getRoutineItems(event.id)
      .then((nextItems) => setItems(nextItems || []))
      .finally(() => setLoading(false));
  }, [event.id, event.routineListId]);

  const completedCount = items.filter((item) => item.completed === 1).length;
  const isComplete = items.length > 0 && completedCount === items.length;

  const handleToggle = async (item: EventRoutineItem, completed: boolean) => {
    await eventsClientService.setRoutineItemCompleted(event.id, item.id, completed);
    setItems((prev) => prev.map((existing) => (
      existing.id === item.id ? { ...existing, completed: completed ? 1 : 0 } : existing
    )));
  };

  const handleReset = async () => {
    await Promise.all(
      items.filter((item) => item.completed === 1).map((item) => (
        eventsClientService.setRoutineItemCompleted(event.id, item.id, false)
      ))
    );
    setItems((prev) => prev.map((item) => ({ ...item, completed: 0 })));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ui-deep-80 p-4 sm:items-center" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-routine-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ui px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-ui-muted">
              <CheckSquare size={14} className="text-purple-500" />
              Attached Routine
            </div>
            <h2 id="event-routine-title" className="truncate text-lg font-bold text-ui-primary">
              {routine?.title || event.title}
            </h2>
            <p className="mt-1 text-sm text-ui-muted">{event.title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-ui-muted transition-colors hover:bg-ui-soft">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-ui-muted">Loading routine...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-ui-muted">This routine does not have any checklist items yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleToggle(item, item.completed !== 1)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ui bg-ui-soft px-4 py-3 text-left"
                >
                  <span className={cn("text-sm font-semibold", item.completed === 1 ? "text-ui-muted line-through" : "text-ui-primary")}>
                    {item.text}
                  </span>
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2",
                    item.completed === 1 ? "border-emerald-500 bg-emerald-500 text-white" : "border-ui-soft-3 bg-white text-transparent",
                  )}>
                    <Check size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-ui px-5 py-4">
            <button
              type="button"
              onClick={() => void (isComplete ? handleReset() : Promise.all(items.filter((item) => item.completed !== 1).map((item) => handleToggle(item, true))))}
              className={cn(
                "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-colors",
                isComplete ? "bg-emerald-500 hover:bg-emerald-600" : "bg-purple-500 hover:bg-purple-600",
              )}
            >
              {isComplete ? <RotateCcw size={16} /> : <Check size={16} />}
              {isComplete ? 'Reset Routine' : 'Complete All'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
