import React from 'react';
import { CalendarCheck2, ListTodo, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToolsSection = 'tasks' | 'routines' | 'meals';

interface ToolsMenuProps {
  activeSection: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (section: ToolsSection) => void;
}

const OPTIONS: Array<{ id: ToolsSection; title: string; description: string; icon: typeof ListTodo }> = [
  { id: 'tasks', title: 'Tasks', description: 'Assignments, approvals, and progress', icon: ListTodo },
  { id: 'routines', title: 'Routines', description: 'Shared checklists and repeatable lists', icon: CalendarCheck2 },
  { id: 'meals', title: 'Meals', description: 'Recipes, plans, and the weekly menu', icon: UtensilsCrossed },
];

export function ToolsMenu({ activeSection, isOpen, onClose, onSelect }: ToolsMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-20 max-w-sm rounded-[2rem] border border-ui bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-ui-soft px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">
              <ShoppingBag size={12} />
              Tools
            </div>
            <h3 className="mt-3 text-xl font-black text-ui-primary">Jump to family tools</h3>
            <p className="mt-1 text-sm text-ui-muted">Open the heavier management areas without crowding the main mobile nav.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ui-muted transition-colors hover:bg-ui-soft hover:text-ui-primary"
            aria-label="Close tools menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  activeSection === option.id ? "border-sky-300 bg-sky-50" : "border-ui bg-ui-soft hover:bg-white",
                )}
              >
                <div className="rounded-xl bg-white p-2 text-sky-600 shadow-sm">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-bold text-ui-primary">{option.title}</p>
                  <p className="text-xs text-ui-muted">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
