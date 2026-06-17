import React from 'react';
import { CalendarCheck2, ListTodo, ShoppingBag, UtensilsCrossed, Users2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToolsSection = 'tasks' | 'routines' | 'meals' | 'manage';

interface ToolsMenuProps {
  activeSection: string;
  isOpen: boolean;
  isDarkTheme?: boolean;
  onClose: () => void;
  onSelect: (section: ToolsSection) => void;
}

const OPTIONS: Array<{ id: ToolsSection; title: string; description: string; icon: typeof ListTodo }> = [
  { id: 'tasks', title: 'Tasks', description: 'Assignments, approvals, and progress', icon: ListTodo },
  { id: 'routines', title: 'Routines', description: 'Shared checklists and repeatable lists', icon: CalendarCheck2 },
  { id: 'meals', title: 'Meals', description: 'Recipes, plans, and the weekly menu', icon: UtensilsCrossed },
  { id: 'manage', title: 'Family Overview', description: 'Task approvals, kid progress, categories', icon: Users2 },
];

export function ToolsMenu({ activeSection, isOpen, isDarkTheme, onClose, onSelect }: ToolsMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/45 p-4 backdrop-blur-sm pb-[calc(env(safe-area-inset-bottom,16px)+4.25rem)]" onClick={onClose}>
      <div
        className={cn("mx-auto w-full max-w-sm rounded-[2rem] border p-5 shadow-2xl", isDarkTheme ? "bg-ui-deep border-ui-dark" : "bg-white border-ui")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em]", isDarkTheme ? "bg-ui-dark-2 text-ui-secondary" : "bg-ui-soft text-ui-muted")}>
              <ShoppingBag size={12} />
              Tools
            </div>
            <h3 className={cn("mt-3 text-xl font-black", isDarkTheme ? "text-white" : "text-ui-primary")}>Jump to family tools</h3>
            <p className={cn("mt-1 text-sm", isDarkTheme ? "text-ui-secondary" : "text-ui-muted")}>Open the heavier management areas without crowding the main mobile nav.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn("rounded-full p-2 transition-colors", isDarkTheme ? "text-ui-secondary hover:bg-ui-dark-2 hover:text-white" : "text-ui-muted hover:bg-ui-soft hover:text-ui-primary")}
            aria-label="Close tools menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = activeSection === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  isActive
                    ? "border-sky-400 bg-sky-500/10"
                    : isDarkTheme
                      ? "border-ui-dark bg-ui-dark-50 hover:bg-ui-dark-2"
                      : "border-ui bg-ui-soft hover:bg-white",
                )}
              >
                <div className={cn("rounded-xl p-2 shadow-sm", isDarkTheme ? "bg-ui-dark-2 text-sky-400" : "bg-white text-sky-600")}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className={cn("font-bold", isDarkTheme ? "text-white" : "text-ui-primary")}>{option.title}</p>
                  <p className={cn("text-xs", isDarkTheme ? "text-ui-secondary" : "text-ui-muted")}>{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
