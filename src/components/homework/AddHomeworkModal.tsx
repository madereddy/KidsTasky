import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface Props {
  kids: UserProfile[];
  onClose: () => void;
  onSubmit: (payload: { title: string; subject: string; notes?: string; dueDate: string; assignedToId?: string; color: string }) => Promise<void>;
}

export function AddHomeworkModal({ kids, onClose, onSubmit }: Props) {
  const { dialogRef, onKeyDown } = useDialogA11y(true, onClose);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [color, setColor] = useState('#6366f1');

  return (
    <div className="fixed inset-0 bg-ui-deep-80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-homework-title" tabIndex={-1} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl border border-ui p-5 space-y-3">
        <h3 id="add-homework-title" className="text-lg font-bold text-ui-primary">Add Homework</h3>
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="w-full border border-ui rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <select className="w-full border border-ui rounded-lg px-3 py-2 text-sm" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
          <option value="">All kids</option>
          {kids.map((kid) => <option key={kid.uid} value={kid.uid}>{kid.name}</option>)}
        </select>
        <input className="w-full border border-ui rounded-lg px-3 py-2 text-sm" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-ui-soft-2 text-ui-secondary font-semibold">Cancel</button>
          <button
            onClick={async () => {
              if (!title || !subject || !dueDate) return;
              await onSubmit({ title, subject, notes: notes || undefined, dueDate, assignedToId: assignedToId || undefined, color });
              onClose();
            }}
            className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
