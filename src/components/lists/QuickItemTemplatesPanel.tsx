import React, { useMemo, useState } from 'react';
import { Pin, PinOff, Save, Star, Trash2 } from 'lucide-react';
import { ProofTemplate } from '../../services/proofTemplates';
import { cn } from '../../lib/utils';

interface Props {
  templates: ProofTemplate[];
  draftText: string;
  onApply: (text: string) => void;
  onSave: (name: string, text: string, pinned: boolean) => void;
  onRemove: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

export function QuickItemTemplatesPanel({ templates, draftText, onApply, onSave, onRemove, onTogglePin }: Props) {
  const [templateName, setTemplateName] = useState('');
  const [pinOnSave, setPinOnSave] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const pinnedTemplates = useMemo(
    () => templates.filter((template) => template.pinned),
    [templates],
  );
  const unpinnedTemplates = useMemo(
    () => templates.filter((template) => !template.pinned).slice(0, 6),
    [templates],
  );

  const handleSave = () => {
    const name = templateName.trim();
    const text = draftText.trim();
    if (!name || !text) return;
    onSave(name, text, pinOnSave);
    setTemplateName('');
    setPinOnSave(true);
  };

  return (
    <div className="space-y-3 rounded-[1.25rem] border border-ui bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <button 
          type="button" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="group flex min-h-[44px] flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-ui-muted group-hover:text-ui-primary transition-colors">
              <Star size={12} aria-hidden="true" className={cn(isCollapsed ? "" : "text-amber-500 fill-amber-500")} />
              Quick Library
            </div>
            {!isCollapsed && (
              <p className="mt-1 text-xs text-ui-muted">Save repeat items once, then drop them into any routine or shopping list.</p>
            )}
          </div>
          <span className="text-[10px] font-bold text-ui-muted uppercase group-hover:text-ui-primary">
            {isCollapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
      </div>

      {!isCollapsed && (
        <>
          {pinnedTemplates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pinnedTemplates.map((template) => {
                const templateText = template.questions[0] || template.name;
                return (
                  <div key={template.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-ui bg-ui-soft px-1 py-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => onApply(templateText)}
                      className="min-h-[44px] px-2 truncate text-xs font-bold text-ui-primary"
                    >
                      + {template.name}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => onTogglePin(template.id, false)} 
                      className="flex h-11 w-11 items-center justify-center text-ui-muted hover:text-ui-primary rounded-full transition-colors"
                      aria-label={`Unpin ${template.name}`}
                    >
                      <PinOff size={16} aria-hidden="true" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => onRemove(template.id)} 
                      className="flex h-11 w-11 items-center justify-center text-ui-muted hover:text-red-600 rounded-full transition-colors"
                      aria-label={`Remove ${template.name}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {unpinnedTemplates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unpinnedTemplates.map((template) => {
                const templateText = template.questions[0] || template.name;
                return (
                  <div key={template.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-ui bg-ui-soft px-1 py-1">
                    <button 
                      type="button" 
                      onClick={() => onApply(templateText)} 
                      className="min-h-[44px] px-2 truncate text-xs font-bold text-ui-primary"
                    >
                      + {template.name}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => onTogglePin(template.id, true)} 
                      className="flex h-11 w-11 items-center justify-center text-ui-muted hover:text-amber-500 rounded-full transition-colors"
                      aria-label={`Pin ${template.name}`}
                    >
                      <Pin size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Save current item as..."
              className="min-h-[44px] rounded-xl border border-ui px-3 py-2 text-sm text-ui-primary focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setPinOnSave((value) => !value)}
              className={cn(
                "min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
                pinOnSave ? "border-ui-primary bg-ui-primary text-white" : "border-ui bg-ui-soft text-ui-muted",
              )}
            >
              {pinOnSave ? 'Pinned' : 'Regular'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!templateName.trim() || !draftText.trim()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-ui-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-ui-primary/90 disabled:cursor-not-allowed disabled:bg-ui-soft-3 disabled:text-ui-muted"
            >
              <Save size={14} aria-hidden="true" />
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}
