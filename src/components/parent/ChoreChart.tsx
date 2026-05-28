import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Category, Task, UserProfile } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  tasks: Task[];
  kids: UserProfile[];
  categories: Category[];
  memberColorMap?: Record<string, string>;
}

export function ChoreChart({ tasks, kids, categories, memberColorMap = {} }: Props) {
  const activeTasks = tasks.filter((task) => task.status !== 'archived');

  if (activeTasks.length === 0 || kids.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-ui-muted text-sm">
        No tasks or kids to display.
      </div>
    );
  }

  const getCategoryColor = (categoryId?: string) => {
    if (!categoryId) return '#6366f1';
    return categories.find((category) => category.id === categoryId)?.color || '#6366f1';
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-ui bg-white shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-ui-soft">
            <th className="text-left px-4 py-3 font-semibold text-ui-secondary min-w-[180px] border-b border-ui">
              Chore
            </th>
            <th className="px-4 py-3 font-semibold text-center border-b border-ui min-w-[120px]">
              <span className="text-xs text-ui-secondary">Up for grabs</span>
            </th>
            {kids.map((kid) => {
              const color = memberColorMap[kid.uid] ?? kid.color ?? '#6366f1';
              return (
                <th key={kid.uid} className="px-4 py-3 font-semibold text-center border-b border-ui min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: color }}
                    >
                      {kid.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-xs text-ui-secondary">{kid.name}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {activeTasks.map((task, idx) => (
            <tr key={task.id} className={cn('transition-colors', idx % 2 === 0 ? 'bg-white' : 'bg-ui-soft/40')}>
              <td className="px-4 py-3 font-medium text-ui-primary border-r border-ui">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(task.categoryId) }} />
                  {task.title}
                </div>
              </td>
              <td className="px-4 py-3 text-center border-r border-ui">
                {task.assignedKidId === 'all'
                  ? <CheckCircle2 className="w-5 h-5 mx-auto text-sky-500" />
                  : <Circle className="w-5 h-5 mx-auto text-ui-soft-3" />}
              </td>
              {kids.map((kid) => {
                const assigned = task.assignedKidId === kid.uid;
                const color = memberColorMap[kid.uid] ?? kid.color ?? '#6366f1';
                return (
                  <td key={kid.uid} className="px-4 py-3 text-center border-r border-ui last:border-r-0">
                    {assigned
                      ? <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color }} />
                      : <Circle className="w-5 h-5 mx-auto text-ui-soft-3" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
