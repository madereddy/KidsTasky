import React, { useState } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { eventsClientService } from '../../services/events';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { useDialogA11y } from '../../hooks/useDialogA11y';

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];

interface Props {
  onClose: () => void;
  onSubmit: () => void;
  kids: UserProfile[];
  parentId: string;
  defaultDate?: Date;
  defaultStartTime?: string;
}

export function AddEventModal({ onClose, onSubmit, kids, parentId, defaultDate, defaultStartTime }: Props) {
  const { dialogRef, onKeyDown } = useDialogA11y(true, onClose);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(defaultStartTime || '09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [assignedToId, setAssignedToId] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [isAllDay, setIsAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<'none'|'daily'|'weekly'|'monthly'|'yearly'>('none');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const startMs = isAllDay ? new Date(date + 'T00:00:00').getTime() : new Date(`${date}T${startTime}`).getTime();
      const endMs = isAllDay ? new Date(date + 'T23:59:59.999').getTime() : new Date(`${date}T${endTime}`).getTime();
      
      await eventsClientService.createEvent({
        parentId,
        title: title.trim(),
        description: description.trim(),
        startTime: startMs,
        endTime: endMs > startMs ? endMs : startMs + 3600000,
        color,
        assignedToId: assignedToId || undefined,
        isAllDay: isAllDay ? 1 : 0,
        recurrence,
        recurrenceEnd: recurrence !== 'none' ? recurrenceEnd : undefined,
        reminderMinutes: reminderMinutes ?? undefined,
      });
      onSubmit();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ui-deep-80 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-event-title" tabIndex={-1} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 id="add-event-title" className="text-lg font-bold">Add Event</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-ui-soft-2 rounded-full">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ui-secondary mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ui-secondary mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ui-secondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="allday" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="rounded" />
            <label htmlFor="allday" className="text-xs font-semibold text-ui-secondary">All day</label>
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ui-secondary mb-1">Start time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ui-secondary mb-1">End time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ui-secondary mb-1">Repeat</label>
            <select value={recurrence} onChange={e => setRecurrence(e.target.value as any)}
              className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {recurrence !== 'none' && (
            <div>
              <label className="block text-xs font-semibold text-ui-secondary mb-1">End repeat</label>
              <input type="date" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)}
                className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ui-secondary mb-1">Remind me</label>
            <select value={reminderMinutes ?? ''} onChange={e => setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">No reminder</option>
              <option value="0">At time of event</option>
              <option value="5">5 minutes before</option>
              <option value="10">10 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ui-secondary mb-1">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all",
                    color === c ? "border-ui-dark-2 scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ui-secondary mb-1">Assign to</label>
            <select
              value={assignedToId}
              onChange={e => setAssignedToId(e.target.value)}
              className="w-full border border-ui rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Everyone</option>
              {kids.map(k => <option key={k.uid} value={k.uid}>{k.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-ui-soft-2 text-ui-secondary rounded-xl text-sm font-semibold hover:bg-ui-soft-3">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-60">
              {saving ? 'Saving…' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
