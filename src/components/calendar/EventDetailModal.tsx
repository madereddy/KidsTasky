import React, { useState } from 'react';
import { format } from 'date-fns';
import { X, Edit2, Trash2 } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { CalendarEvent, UserProfile } from '../../types';
import { cn } from '../../lib/utils';

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];
const REMINDER_LABELS: Record<number, string> = { 0: 'At time', 5: '5 min before', 10: '10 min before', 15: '15 min before', 30: '30 min before', 60: '1 hr before', 1440: '1 day before' };

interface Props {
  event: CalendarEvent;
  kids: UserProfile[];
  userRole: 'parent' | 'kid';
  onClose: () => void;
  onUpdated: () => void;
}

type DeleteScope = 'one' | 'future';

export function EventDetailModal({ event, kids, userRole, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [color, setColor] = useState(event.color);
  const [assignedToId, setAssignedToId] = useState(event.assignedToId || '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(event.reminderMinutes ?? null);
  const [isCountdown, setIsCountdown] = useState(Boolean(event.isCountdown));
  const [saving, setSaving] = useState(false);
  const [showDeleteScope, setShowDeleteScope] = useState(false);
  const [showEditScope, setShowEditScope] = useState(false);
  const isRecurring = Boolean(event.masterId);
  const isParent = userRole === 'parent';

  const handleSave = async (scope: 'one' | 'future' = 'one') => {
    setSaving(true);
    try {
      await eventsClientService.updateEvent(event.id, { title, description, color, assignedToId: assignedToId || undefined, reminderMinutes: reminderMinutes ?? undefined, isCountdown: isCountdown ? 1 : 0 }, scope);
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scope: DeleteScope) => {
    await eventsClientService.deleteEvent(event.id, scope);
    onUpdated();
    onClose();
  };

  const assignee = kids.find(k => k.uid === event.assignedToId);
  const recurrenceLabel = event.recurrence && event.recurrence !== 'none'
    ? `${event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}${event.recurrenceEnd ? ` until ${event.recurrenceEnd}` : ''}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderLeftColor: event.color, borderLeftWidth: 4 }}>
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 text-lg font-bold border-b border-ui-soft focus:outline-none mr-2" />
          ) : (
            <h2 className="text-lg font-bold">{event.title}</h2>
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
              {event.reminderMinutes != null && <p className="text-sm text-ui-muted">Reminder: {REMINDER_LABELS[event.reminderMinutes] || `${event.reminderMinutes} min before`}</p>}
              {event.isCountdown ? <p className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg inline-block">Countdown event</p> : null}
            </>
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
