import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  helperText?: string;
  values: string[];
  placeholder: string;
  addLabel?: string;
  disabled?: boolean;
  onChange: (nextValues: string[]) => Promise<unknown> | unknown;
}

export function HouseholdTagManager({
  title,
  helperText,
  values,
  placeholder,
  addLabel = 'Add',
  disabled = false,
  onChange,
}: Props) {
  const [draft, setDraft] = useState('');

  const handleAdd = async () => {
    const value = draft.trim();
    if (!value) return;
    await onChange([...values, value]);
    setDraft('');
  };

  const handleRemove = async (value: string) => {
    await onChange(values.filter((entry) => entry.toLowerCase() !== value.toLowerCase()));
  };

  return (
    <div className="space-y-2 rounded-xl border border-ui bg-white p-3">
      <div>
        <h4 className="text-sm font-bold text-ui-primary">{title}</h4>
        {helperText && <p className="mt-1 text-xs text-ui-muted">{helperText}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full border border-ui bg-ui-soft px-2.5 py-1 text-xs font-semibold text-ui-secondary"
          >
            {value}
            <button
              type="button"
              onClick={() => void handleRemove(value)}
              disabled={disabled}
              className="rounded-full p-0.5 text-ui-muted hover:bg-ui-soft-2 hover:text-red-500 disabled:opacity-50"
              aria-label={`Remove ${value}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-ui px-3 py-2 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={disabled || !draft.trim()}
          className="min-h-11 rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-ui-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
