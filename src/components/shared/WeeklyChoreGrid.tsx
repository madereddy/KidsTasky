import React, { useMemo } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { Task, UserProfile, TaskCompletion } from '../../types';
import { cn } from '../../lib/utils';

interface WeeklyChoreGridProps {
  tasks: Task[];
  kids: UserProfile[];
  completions: TaskCompletion[];
  weekStart?: Date;
  compact?: boolean;
}

export function WeeklyChoreGrid({ tasks, kids, completions, weekStart, compact = false }: WeeklyChoreGridProps) {
  const monday = useMemo(() => {
    const base = weekStart ?? new Date();
    return startOfWeek(base, { weekStartsOn: 1 });
  }, [weekStart]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  );

  const completionSet = useMemo(() => {
    const s = new Set<string>();
    completions.forEach(c => s.add(`${c.taskId}:${c.dateString}`));
    return s;
  }, [completions]);

  const activeTasks = tasks.filter(t => t.status !== 'archived');

  if (activeTasks.length === 0 || kids.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-ui-muted">
        No chores this week.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse", compact ? "text-xs" : "text-sm")}>
        <thead>
          <tr>
            <th className="text-left pb-2 pr-3 font-semibold text-ui-muted w-32">
              {compact ? '' : 'Chore'}
            </th>
            {weekDays.map(d => (
              <th key={d.toISOString()} className="text-center pb-2 px-1 font-semibold text-ui-muted min-w-[2rem]">
                <div>{format(d, 'EEE')[0]}</div>
                {!compact && <div className="text-xs font-normal">{format(d, 'd')}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kids.map(kid => {
            const kidTasks = activeTasks.filter(t => t.assignedKidId === kid.uid);
            if (kidTasks.length === 0) return null;
            return (
              <React.Fragment key={kid.uid}>
                <tr>
                  <td colSpan={8} className="pt-3 pb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: kid.color || '#6366f1' }} />
                      <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{kid.name}</span>
                    </div>
                  </td>
                </tr>
                {kidTasks.map(task => (
                  <tr key={task.id} className="hover:bg-ui-soft transition-colors">
                    <td className="py-1 pr-3 text-ui-secondary truncate max-w-[8rem]">{task.title}</td>
                    {weekDays.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const done = completionSet.has(`${task.id}:${dateStr}`);
                      return (
                        <td key={dateStr} className="text-center py-1 px-1">
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full mx-auto border-2 transition-colors",
                              done
                                ? "bg-emerald-500 border-emerald-500"
                                : "bg-transparent border-ui"
                            )}
                            data-testid={done ? 'chore-complete' : 'chore-pending'}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
