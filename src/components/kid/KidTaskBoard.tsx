import React from 'react';
import { Award } from 'lucide-react';
import { Task, TaskCompletion, Category } from '../../types';
import { cn } from '../../lib/utils';
import { TaskCard } from './TaskCard';

type Urgency = 'none' | 'soon' | 'overdue';

interface TaskSection {
  key: string;
  title: string;
  titleClass: string;
  tasks: Task[];
}

interface Props {
  sections: TaskSection[];
  taskView: 'all' | 'upforgrabs' | 'assigned';
  filteredTasksLength: number;
  isDarkMode: boolean;
  panelBgClass?: string;
  panelBorderClass?: string;
  noTasksText: string;
  categories: Category[];
  themeVocab: any;
  getUrgency: (task: Task) => Urgency;
  isTaskLocked: (task: Task) => boolean;
  isCompleted: (taskId: string, count?: number) => boolean;
  isTaskPending: (taskId: string, count?: number) => boolean;
  getCompletion: (taskId: string, count?: number) => TaskCompletion | undefined;
  onToggleTask: (taskId: string, currentStatus: boolean, count?: number) => void;
  onSkipTask: (taskId: string, count?: number) => void;
}

export function KidTaskBoard({
  sections,
  taskView,
  filteredTasksLength,
  isDarkMode,
  panelBgClass,
  panelBorderClass,
  noTasksText,
  categories,
  themeVocab,
  getUrgency,
  isTaskLocked,
  isCompleted,
  isTaskPending,
  getCompletion,
  onToggleTask,
  onSkipTask,
}: Props) {
  const renderTaskCards = (taskList: Task[]) => taskList.map((task: Task) => {
    const urgency = getUrgency(task);
    const category = categories.find(c => c.id === task.categoryId);
    const locked = isTaskLocked(task);

    if (task.frequency === 'twice-daily') {
      return (
        <React.Fragment key={task.id}>
          {[1, 2].map(slot => (
            <TaskCard
              key={`${task.id}-${slot}`}
              task={task}
              isDone={isCompleted(task.id, slot)}
              isPending={isTaskPending(task.id, slot)}
              completion={getCompletion(task.id, slot)}
              isLocked={locked}
              onToggle={() => onToggleTask(task.id, isCompleted(task.id, slot), slot)}
              onSkip={() => onSkipTask(task.id, slot)}
              urgency={urgency}
              slotLabel={slot === 1 ? 'Morning' : 'Evening'}
              category={category}
              themeVocab={themeVocab}
              darkMode={themeVocab?.darkMode}
            />
          ))}
        </React.Fragment>
      );
    }

    return (
      <TaskCard
        key={task.id}
        task={task}
        isDone={isCompleted(task.id)}
        isPending={isTaskPending(task.id)}
        completion={getCompletion(task.id)}
        isLocked={locked}
        onToggle={() => onToggleTask(task.id, isCompleted(task.id))}
        onSkip={() => onSkipTask(task.id)}
        urgency={urgency}
        category={category}
        themeVocab={themeVocab}
        darkMode={themeVocab?.darkMode}
      />
    );
  });

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        section.tasks.length > 0 ? (
          <div key={section.key} className="space-y-3">
            {taskView === 'all' && (
              <div className="px-2">
                <p className={cn("text-xs font-bold uppercase tracking-widest", section.titleClass)}>{section.title}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderTaskCards(section.tasks)}
            </div>
          </div>
        ) : null
      ))}

      {filteredTasksLength === 0 && (
        <div className={cn("col-span-full text-center py-20 rounded-[3rem]", panelBgClass || "bg-white", panelBorderClass ? `border ${panelBorderClass}` : "shadow-sm")}>
          <Award className={cn("w-20 h-20 mx-auto mb-4", isDarkMode ? "text-ui-muted" : "text-ui-secondary")} />
          <p className={cn("text-lg font-bold", isDarkMode ? "text-ui-secondary" : "text-ui-muted-2")}>{noTasksText}</p>
        </div>
      )}
    </div>
  );
}
