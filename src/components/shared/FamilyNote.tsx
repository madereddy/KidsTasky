import React, { useState, useEffect, useRef } from 'react';
import { notesClientService } from '../../services/notes';
import { clientLogger } from '../../services/clientLogger';

interface Props {
  parentId: string;
  readOnly?: boolean;
}

export function FamilyNote({ parentId, readOnly = false }: Props) {
  const [content, setContent] = useState('');
  const [updatedByName, setUpdatedByName] = useState('');
  const [updatedAt, setUpdatedAt] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notesClientService.getNote(parentId).then((d) => {
      setContent(d.content || '');
      setUpdatedByName(d.updatedByName || '');
      setUpdatedAt(d.updatedAt || 0);
    });
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [parentId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await notesClientService.saveNote(parentId, val).catch((error) => {
        clientLogger.warn('family_note_save_failed', { parentId, error });
      });
      setUpdatedAt(Date.now());
      setSaving(false);
    }, 1000);
  }

  function formatRelativeTime(ts: number): string {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  }

  return (
    <div className="relative bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-sm">
      <div className="text-xs font-semibold text-amber-800 mb-1 flex items-center justify-between">
        <span>Family Note</span>
        {saving && <span className="text-ui-muted-2 font-normal">Saving...</span>}
      </div>
      {readOnly ? (
        <p className="text-sm whitespace-pre-wrap text-ui-secondary min-h-[40px]">
          {content || <span className="text-ui-muted-2 italic">No note yet</span>}
        </p>
      ) : (
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Write a family note..."
          rows={3}
          className="w-full text-sm bg-transparent resize-none outline-none text-ui-secondary placeholder:text-ui-muted-2"
        />
      )}
      {updatedByName && updatedAt > 0 && (
        <p className="text-xs text-ui-muted-2 mt-1">
          Last updated by {updatedByName}, {formatRelativeTime(updatedAt)}
        </p>
      )}
    </div>
  );
}
