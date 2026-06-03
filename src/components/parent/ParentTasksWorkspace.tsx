import React, { useState } from 'react';
import { Grid3x3, List, ShieldCheck } from 'lucide-react';
import { Task, UserProfile, Category } from '../../types';
import { cn } from '../../lib/utils';
import { ParentTaskBoard } from './ParentTaskBoard';
import { ChoreChart } from './ChoreChart';
import { AddTaskModal } from './AddTaskModal';
import { CategoryManager } from './CategoryManager';
import { HomeworkView } from '../homework/HomeworkView';
import { MEMBER_COLORS } from '../../constants';
import { StaleDataEvent, useSocketStaleData } from '../../hooks/useSocket';
import { useParentTaskWorkspace } from '../../hooks/useParentTaskWorkspace';

interface Props {
  parentId: string;
  kids: UserProfile[];
  categories: Category[];
  selectedCategoryId: string | null;
  isLocked?: boolean;
  isDarkMode?: boolean;
  onCategoriesChange: (cats: Category[]) => void;
}

export function ParentTasksWorkspace({
  parentId,
  kids,
  categories,
  selectedCategoryId,
  isLocked = false,
  isDarkMode = false,
  onCategoriesChange,
}: Props) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'created'>('created');
  const [taskDisplayMode, setTaskDisplayMode] = useState<'list' | 'chart'>('list');
  const {
    tasks,
    pendingCompletions,
    todayApprovedCompletions,
    loadWorkspace,
    addTask,
    archiveTask,
    editTask,
    approveCompletion,
    rejectCompletion,
    undoCompletion,
  } = useParentTaskWorkspace({
    parentId,
    kids,
  });

  useSocketStaleData(['tasks', 'completions'], (data: StaleDataEvent) => {
    const signal = data.type || data.entity;
    if (signal === 'tasks' || signal === 'completions') {
      loadWorkspace().catch((e) => console.error('Failed refreshing tasks workspace:', e));
    }
  });

  return (
    <div className="space-y-6">
      {pendingCompletions.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2.5rem] space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-700">Awaiting Approval</h3>
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCompletions.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingCompletions.map((comp: any) => (
              <div key={comp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex justify-between items-center group">
                <div>
                  <p className="text-xs font-black text-amber-600 uppercase mb-1">{comp.kidName}</p>
                  <p className="font-bold text-ui-primary text-sm">{comp.taskTitle}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void rejectCompletion(comp.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Reject"
                  >
                    Reject
                  </button>
                  <button
                  onClick={() => void approveCompletion(comp.id)}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {todayApprovedCompletions.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2.5rem] space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-700">Completed Today</h3>
            <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{todayApprovedCompletions.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayApprovedCompletions.map((comp: any) => (
              <div key={comp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex justify-between items-center">
                <div>
                  <p className="text-xs font-black text-emerald-600 uppercase mb-1">{comp.kidName}</p>
                  <p className="font-bold text-ui-primary text-sm">{comp.taskTitle || comp.taskId}</p>
                </div>
                <button
                  onClick={() => void undoCompletion(comp)}
                  className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-rose-100 transition-colors"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <div className={cn('flex gap-1 p-1 rounded-xl', isDarkMode ? 'bg-ui-dark-50' : 'bg-ui-soft-2')}>
          <button
            onClick={() => setTaskDisplayMode('list')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
              taskDisplayMode === 'list' ? 'bg-sky-500 text-white shadow-sm' : (isDarkMode ? 'text-ui-secondary' : 'text-ui-muted')
            )}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setTaskDisplayMode('chart')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
              taskDisplayMode === 'chart' ? 'bg-sky-500 text-white shadow-sm' : (isDarkMode ? 'text-ui-secondary' : 'text-ui-muted')
            )}
          >
            <Grid3x3 className="w-3.5 h-3.5" /> Chart
          </button>
        </div>
      </div>

      {taskDisplayMode === 'list' ? (
        <ParentTaskBoard
          tasks={tasks}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          isDarkMode={isDarkMode}
          isLocked={isLocked}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onArchiveTask={archiveTask}
          onEditTask={setEditingTask}
          onOpenCategories={() => setIsManagingCategories(true)}
          onOpenAddTask={() => setIsAddingTask(true)}
          onCategoriesChange={onCategoriesChange}
        />
      ) : (
        <ChoreChart
          tasks={tasks}
          kids={kids}
          categories={categories}
          memberColorMap={Object.fromEntries(kids.map((kid) => [kid.uid, kid.color || MEMBER_COLORS[0]]))}
        />
      )}

      <HomeworkView parentId={parentId} kids={kids} userRole="parent" />

      {isAddingTask && (
        <AddTaskModal
          onClose={() => setIsAddingTask(false)}
          onSubmit={async (payload) => {
            await addTask(payload);
            setIsAddingTask(false);
          }}
          kids={kids}
          parentId={parentId}
          categories={categories}
          existingTasks={tasks}
        />
      )}
      {editingTask && (
        <AddTaskModal
          onClose={() => setEditingTask(null)}
          onSubmit={async (payload) => {
            await editTask(editingTask.id, {
              title: payload.title,
              frequency: payload.frequency,
              difficulty: payload.difficulty,
              assignedKidId: payload.assignedKidId === 'all' ? 'all' : (Array.isArray(payload.assignedKidIds) ? payload.assignedKidIds[0] : payload.assignedKidId),
              reminderTime: payload.reminderTime,
              categoryId: payload.categoryId || null,
              customInterval: payload.frequency === 'custom' ? payload.customInterval : null,
              prerequisiteTaskIds: payload.prerequisiteTaskIds || [],
              starValue: payload.starValue,
              requiresApproval: payload.requiresApproval,
              completionQuestions: payload.completionQuestions || [],
              completionQuestionsKidId: payload.completionQuestionsKidId || null,
            } as any);
            setEditingTask(null);
          }}
          kids={kids}
          parentId={parentId}
          categories={categories}
          existingTasks={tasks.filter((t) => t.id !== editingTask.id)}
          initialTask={editingTask}
          modalTitle="Edit Mission"
          submitLabel="Save"
          allowMultiAssign={false}
        />
      )}
      {isManagingCategories && (
        <CategoryManager
          parentId={parentId}
          categories={categories}
          onClose={() => setIsManagingCategories(false)}
          onUpdate={onCategoriesChange}
        />
      )}
    </div>
  );
}
