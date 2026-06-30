import React from 'react';
import { Calendar, Clock, Trash2, Tag, Plus, Pencil } from 'lucide-react';
import { Category, Task, UserProfile } from '../../types';
import { cn, parseTimestamp } from '../../lib/utils';

interface Props {
  tasks: Task[];
  categories: Category[];
  kids: UserProfile[];
  selectedCategoryId: string | null;
  isDarkMode: boolean;
  isLocked: boolean;
  sortBy: 'time' | 'created';
  onSortByChange: (sort: 'time' | 'created') => void;
  onArchiveTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onOpenCategories: () => void;
  onOpenAddTask: () => void;
  onCategoriesChange: (cats: Category[]) => void;
}

export function ParentTaskBoard({
  tasks,
  categories,
  kids,
  selectedCategoryId,
  isDarkMode,
  isLocked,
  sortBy,
  onSortByChange,
  onArchiveTask,
  onEditTask,
  onOpenCategories,
  onOpenAddTask,
  onCategoriesChange,
}: Props) {
  const filteredTasks = (selectedCategoryId
    ? tasks.filter((t: Task) => t.categoryId === selectedCategoryId)
    : [...tasks]).sort((a: Task, b: Task) => {
      if (sortBy === 'time') {
        const timeA = a.reminderTime || '99:99';
        const timeB = b.reminderTime || '99:99';
        return timeA.localeCompare(timeB);
      }
      return parseTimestamp(b.createdAt).getTime() - parseTimestamp(a.createdAt).getTime();
    });

  return (
    <>
      <div className="flex flex-wrap justify-between items-center bg-ui-soft p-2 rounded-2xl gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className={cn("flex gap-1 p-1 rounded-xl mr-2", isDarkMode ? "bg-ui-dark-50" : "bg-ui-soft-2")}>
            <button
              onClick={() => onSortByChange('time')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'time' ? "bg-sky-500 text-white shadow-md" : (isDarkMode ? "text-ui-secondary hover:text-white hover:bg-ui-dark-2" : "text-ui-muted hover:text-ui-secondary hover:bg-ui-soft")
              )}
            >
              <Clock className="w-3 h-3" /> Time
            </button>
            <button
              onClick={() => onSortByChange('created')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'created' ? "bg-sky-500 text-white shadow-md" : (isDarkMode ? "text-ui-secondary hover:text-white hover:bg-ui-dark-2" : "text-ui-muted hover:text-ui-secondary hover:bg-ui-soft")
              )}
            >
              <Calendar className="w-3 h-3" /> New
            </button>
          </div>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategoriesChange(categories)}
              className="p-2 rounded-xl hover:bg-ui-dark-2 transition-colors"
              title={cat.name}
            >
              <span className="text-xl">{cat.icon}</span>
            </button>
          ))}
          <button
            onClick={onOpenCategories}
            className="p-2 bg-white rounded-xl text-ui-muted hover:bg-ui-soft border border-ui transition-colors shadow-sm"
          >
            <Tag className="w-5 h-5" />
          </button>
        </div>

        {!isLocked && (
          <button
            onClick={onOpenAddTask}
            className="btn-immersive-primary !w-auto bg-blue-600 px-6 py-2 text-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Objective
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full text-center py-20 glass-panel rounded-[40px] border-dashed">
            <Calendar className={cn("w-12 h-12 mx-auto mb-4", isDarkMode ? "text-ui-muted-2" : "text-ui-secondary")} />
            <p className={cn(isDarkMode ? "text-ui-secondary" : "text-ui-muted")}>No active missions in sector.</p>
          </div>
        ) : (
          filteredTasks.map((task: Task) => {
            const category = categories.find(c => c.id === task.categoryId);
            return (
              <div key={task.id} className="card-immersive border-l-slate-700 group transition-all hover:scale-[1.01]">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center mb-2">
                      <span className={cn("text-[10px] border font-bold px-2 py-1 rounded uppercase tracking-wider", isDarkMode ? "bg-ui-dark-2 border-ui-dark-2 text-ui-secondary" : "bg-ui-soft-2 border-ui text-ui-muted")}>
                        {task.frequency}
                      </span>
                      {category && (
                        <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider", category.color, "text-white")}>
                          {category.icon} {category.name}
                        </span>
                      )}
                      {task.reminderTime && (
                        <span className="text-[10px] bg-sky-50 border border-sky-100 text-sky-600 font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {task.reminderTime}
                        </span>
                      )}
                      {task.assignedKidId === 'all' ? (
                        <span className="text-[10px] bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 font-bold px-2 py-1 rounded uppercase tracking-wider">
                          Up for Grabs
                        </span>
                      ) : (
                        (() => {
                          const kid = kids.find(k => k.uid === task.assignedKidId);
                          return kid ? (
                            <span className="text-[10px] bg-violet-50 border border-violet-200 text-violet-700 font-bold px-2 py-1 rounded uppercase tracking-wider">
                              {kid.name}
                            </span>
                          ) : null;
                        })()
                      )}
                    </div>
                    <h4 className="text-xl font-bold">{task.title}</h4>
                  </div>
                  {!isLocked && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditTask(task)}
                        className="p-2 text-ui-secondary hover:text-blue-500 transition-colors"
                        aria-label={`Edit ${task.title}`}
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onArchiveTask(task.id)}
                        className="p-2 text-ui-secondary hover:text-red-400 transition-colors"
                        aria-label={`Archive ${task.title}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className={cn("w-full py-2 border font-black rounded-xl text-center uppercase tracking-widest text-[10px]", isDarkMode ? "bg-ui-dark-70 border-ui-dark-2 text-ui-secondary" : "bg-ui-soft border-ui text-ui-muted")}>
                  Monitoring Active
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
