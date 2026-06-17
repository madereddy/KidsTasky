import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { X, Edit2, Trash2, UserCheck, UserX, HelpCircle, UserPlus, CheckSquare, Check } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { listsClientService } from '../../services/lists';
import { AppList, AppListItem, CalendarEvent, UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { useDialogA11y } from '../../hooks/useDialogA11y';

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];
const REMINDER_LABELS: Record<number, string> = { 0: 'At time', 5: '5 min before', 10: '10 min before', 15: '15 min before', 30: '30 min before', 60: '1 hr before', 1440: '1 day before' };

interface Props {
  event: CalendarEvent;
  kids: UserProfile[];
  routineLists?: AppList[];
  userRole: 'parent' | 'kid' | 'coparent';
  onClose: () => void;
  onUpdated: () => void;
}

type DeleteScope = 'one' | 'future';
const RSVP_OPTIONS = [
  { value: 'yes', label: 'Yes', icon: UserCheck, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
  { value: 'no', label: 'No', icon: UserX, color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { value: 'maybe', label: 'Maybe', icon: HelpCircle, color: 'text-amber-500 bg-amber-50 border-amber-200' },
] as const;

export function EventDetailModal({ event, kids, routineLists = [], userRole, onClose, onUpdated }: Props) {
  const { dialogRef, onKeyDown } = useDialogA11y(true, onClose);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [color, setColor] = useState(event.color);
  const [assignedToId, setAssignedToId] = useState(event.assignedToId || '');
  const [routineListId, setRoutineListId] = useState(event.routineListId || '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(event.reminderMinutes ?? null);
  const [isCountdown, setIsCountdown] = useState(Boolean(event.isCountdown));
  const [saving, setSaving] = useState(false);
  const [rsvpSavingFor, setRsvpSavingFor] = useState<string | null>(null);
  const [showDeleteScope, setShowDeleteScope] = useState(false);
  const [showEditScope, setShowEditScope] = useState(false);
  const [attachedRoutineItems, setAttachedRoutineItems] = useState<AppListItem[]>([]);
  const [routineLoading, setRoutineLoading] = useState(false);
  const isRecurring = Boolean(event.masterId);
  const isParent = userRole === 'parent';
  const attachedRoutine = useMemo(
    () => routineLists.find((routine) => routine.id === (routineListId || event.routineListId)) ?? null,
    [event.routineListId, routineListId, routineLists],
  );

  useEffect(() => {
    const targetRoutineId = routineListId || event.routineListId;
    if (!targetRoutineId) {
      setAttachedRoutineItems([]);
      return;
    }
    setRoutineLoading(true);
    listsClientService.getItems(targetRoutineId)
      .then((items) => setAttachedRoutineItems(items || []))
      .catch(() => setAttachedRoutineItems([]))
      .finally(() => setRoutineLoading(false));
  }, [event.routineListId, routineListId]);

  const handleSave = async (scope: 'one' | 'future' = 'one') => {
    setSaving(true);
    try {
      await eventsClientService.updateEvent(event.id, { title, description, color, assignedToId: assignedToId || undefined, routineListId: routineListId || null, reminderMinutes: reminderMinutes ?? undefined, isCountdown: isCountdown ? 1 : 0 }, scope);
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRoutineToggle = async (item: AppListItem, completed: boolean) => {
    await listsClientService.toggleItem(item.id, completed, item.text, item.storeName, item.locationName);
    setAttachedRoutineItems((prev) => prev.map((existing) => (
      existing.id === item.id
        ? { ...existing, completed: completed ? 1 : 0 }
        : existing
    )));
  };

  const handleDelete = async (scope: DeleteScope) => {
    const message = scope === 'future'
      ? 'Are you sure you want to delete this and future events?'
      : 'Are you sure you want to delete this event?';
    if (typeof window !== 'undefined' && !window.confirm(message)) return;
    await eventsClientService.deleteEvent(event.id, scope);
    onUpdated();
    onClose();
  };

  const assignee = kids.find(k => k.uid === event.assignedToId);
  const attendees = event.attendees ?? [];
  const recurrenceLabel = event.recurrence && event.recurrence !== 'none'
    ? `${event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}${event.recurrenceEnd ? ` until ${event.recurrenceEnd}` : ''}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ui-deep-80 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="event-detail-title" aria-label="Event details" tabIndex={-1} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-ui">
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 text-lg font-bold border-b border-ui-soft focus:outline-none mr-2" />
          ) : (
            <h2 id="event-detail-title" className="text-lg font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: event.color || '#6366f1' }} />
              {event.title}
            </h2>
          )}
          <button onClick={onClose} className="p-2 hover:bg-ui-soft-2 rounded-full"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Date/time */}
          <div className="text-sm text-ui-secondary">
            {event.isAllDay
              ? format(new Date(event.startTime), 'EEEE, MMMM d, yyyy') + ' · All day'
              : `${format(new Date(event.startTime), 'EEE, MMM d · h:mm a')} – ${format(new Date(event.endTime), 'h:mm a')}`}
          </div>

          {recurrenceLabel && <div className="text-xs text-ui-muted bg-ui-soft px-2 py-1 rounded-lg inline-block">{recurrenceLabel}</div>}

          {editing ? (
            <>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Description" className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              <div className="flex gap-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-ui-dark-2 scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)} className="w-full border border-ui rounded-lg px-3 py-2 text-sm">
                <option value="">Everyone</option>
                {kids.map(k => <option key={k.uid} value={k.uid}>{k.name}</option>)}
              </select>
              <select value={routineListId} onChange={e => setRoutineListId(e.target.value)} className="w-full border border-ui rounded-lg px-3 py-2 text-sm">
                <option value="">No attached routine</option>
                {routineLists.map((routine) => <option key={routine.id} value={routine.id}>{routine.title}</option>)}
              </select>
              <select value={reminderMinutes ?? ''} onChange={e => setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))} className="w-full border border-ui rounded-lg px-3 py-2 text-sm">
                <option value="">No reminder</option>
                {Object.entries(REMINDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isCountdown} onChange={e => setIsCountdown(e.target.checked)} className="rounded" />
                Show as countdown
              </label>
            </>
          ) : (
            <>
              {event.description && <p className="text-sm text-ui-secondary">{event.description}</p>}
              {assignee && <p className="text-sm text-ui-muted">Assigned to: {assignee.name}</p>}
              {attachedRoutine && <p className="text-sm text-ui-muted">Attached routine: {attachedRoutine.title}</p>}
              {event.reminderMinutes != null && <p className="text-sm text-ui-muted">Reminder: {REMINDER_LABELS[event.reminderMinutes] || `${event.reminderMinutes} min before`}</p>}
              {event.isCountdown ? <p className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg inline-block">Countdown event</p> : null}
            </>
          )}

          {attachedRoutine && (
            <div className="border-t border-ui pt-4 mt-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckSquare size={16} className="text-purple-500" />
                <p className="text-xs font-bold uppercase tracking-widest text-ui-muted">Routine Checklist</p>
              </div>
              {routineLoading ? (
                <p className="text-sm text-ui-muted">Loading routine...</p>
              ) : attachedRoutineItems.length === 0 ? (
                <p className="text-sm text-ui-muted">No checklist items in this routine yet.</p>
              ) : (
                <div className="space-y-2">
                  {attachedRoutineItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleRoutineToggle(item, item.completed !== 1)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-ui bg-ui-soft px-3 py-3 text-left"
                    >
                      <span className={cn("text-sm font-medium", item.completed === 1 ? "text-ui-muted line-through" : "text-ui-primary")}>
                        {item.text}
                      </span>
                      <span className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                        item.completed === 1 ? "border-emerald-500 bg-emerald-500 text-white" : "border-ui-soft-3 bg-white text-transparent",
                      )}>
                        <Check size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {attendees.length > 0 && (
            <div className="border-t border-ui pt-4 mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-ui-muted mb-3">Attendees</p>
              <div className="flex flex-col gap-2">
                {attendees.map((attendee) => (
                  <div key={attendee.userId} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ui-secondary">{attendee.name ?? attendee.userId}</span>
                    <div className="flex gap-1">
                      {RSVP_OPTIONS.map(({ value, label, icon: Icon, color: stateColor }) => (
                        <button
                          key={value}
                          onClick={async () => {
                            try {
                              setRsvpSavingFor(`${attendee.userId}:${value}`);
                              await eventsClientService.updateRsvp(event.id, attendee.userId, value);
                              onUpdated();
                            } finally {
                              setRsvpSavingFor(null);
                            }
                          }}
                          disabled={Boolean(rsvpSavingFor)}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                            attendee.rsvp === value ? stateColor : 'bg-white border-ui text-ui-muted hover:bg-ui-soft',
                            rsvpSavingFor ? 'opacity-60 cursor-not-allowed' : ''
                          )}
                        >
                          <Icon size={12} /> {rsvpSavingFor === `${attendee.userId}:${value}` ? 'Saving...' : label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isParent && !editing && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-ui-muted mb-1">Add attendee</p>
              <div className="flex gap-2 flex-wrap">
                {kids
                  .filter((kid) => !attendees.find((attendee) => attendee.userId === kid.uid))
                  .map((kid) => (
                    <button
                      key={kid.uid}
                      onClick={() => eventsClientService.addAttendee(event.id, kid.uid).then(onUpdated)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-ui-soft border border-ui hover:bg-sky-50 hover:border-sky-300 transition-colors"
                    >
                      <UserPlus size={11} /> {kid.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {isParent && (
          <div className="flex gap-2 p-4 border-t">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-ui-soft-2 text-ui-secondary rounded-xl text-sm font-semibold">Cancel</button>
                {isRecurring && !showEditScope ? (
                  <button onClick={() => setShowEditScope(true)} disabled={saving} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold">Save</button>
                ) : isRecurring && showEditScope ? (
                  <div className="flex-1 flex gap-2">
                    <button onClick={() => handleSave('one')} className="flex-1 py-2 bg-blue-400 text-white rounded-xl text-xs font-semibold">Just this</button>
                    <button onClick={() => handleSave('future')} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">This & future</button>
                  </div>
                ) : (
                  <button onClick={() => handleSave('one')} disabled={saving} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold">{saving ? 'Saving…' : 'Save'}</button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 bg-ui-soft-2 text-ui-secondary rounded-xl text-sm font-semibold hover:bg-ui-soft-3">
                  <Edit2 size={14} /> Edit
                </button>
                <div className="flex-1" />
                {!showDeleteScope ? (
                  <button onClick={() => isRecurring ? setShowDeleteScope(true) : handleDelete('one')} className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm font-semibold hover:bg-rose-100">
                    <Trash2 size={14} /> Delete
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete('one')} className="px-3 py-2 bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold">Just this</button>
                    <button onClick={() => handleDelete('future')} className="px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold">This & future</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
