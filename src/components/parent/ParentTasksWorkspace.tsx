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
import { ParentTasksWorkspaceSkeleton } from '../shared/Skeleton';

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
    isCompletionActionPending,
    loading
  } = useParentTaskWorkspace({
    parentId,
    kids,
  });

  useSocketStaleData(['tasks', 'completions', 'users'], (data: StaleDataEvent) => {
    loadWorkspace().catch(() => {});
  });

  if (loading) {
    return <ParentTasksWorkspaceSkeleton />;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={cn("text-3xl font-black tracking-tight mb-1", isDarkMode ? "text-white" : "text-ui-primary")}>
            Tasks & Achievements
          </h2>
          <p className="text-ui-muted-2 font-medium">Manage family chores and approve completions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsManagingCategories(true)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold border transition-all",
              isDarkMode 
                ? "bg-ui-dark-2 border-ui-dark text-ui-secondary hover:text-white" 
                : "bg-white border-ui text-ui-secondary hover:bg-ui-soft hover:text-ui-primary"
            )}
          >
            Categories
          </button>
          {!isLocked && (
            <button
              onClick={() => setIsAddingTask(true)}
              className="bg-sky-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-sky-500/20 hover:bg-sky-400 transition-all active:scale-95"
            >
              Add New Task
            </button>
          )}
        </div>
      </div>

      {pendingCompletions.length > 0 && (
        <div className="bg-sky-50 border border-sky-100 p-6 rounded-[2.5rem] space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-sky-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-sky-700">Pending Approval</h3>
            <span className="bg-sky-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCompletions.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingCompletions.map((comp) => (
              <div key={comp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-sky-100 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black text-sky-600 uppercase mb-1">{comp.kidName}</p>
                    <p className="font-bold text-ui-primary text-sm">{comp.taskTitle || comp.taskId}</p>
                  </div>
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
            {todayApprovedCompletions.map((comp: any) => {
              const pendingKey = `undo:${comp.id}`;
              const isUndoPending = isCompletionActionPending(pendingKey);
              return (
                <div key={comp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black text-emerald-600 uppercase mb-1">{comp.kidName}</p>
                    <p className="font-bold text-ui-primary text-sm">{comp.taskTitle || comp.taskId}</p>
                  </div>
                  <button
                    onClick={() => void undoCompletion(comp)}
                    disabled={isUndoPending}
                    className={cn(
                      "border px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors",
                      isUndoPending
                        ? "bg-rose-100 border-rose-100 text-rose-400 cursor-not-allowed"
                        : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
                    )}
                  >
                    {isUndoPending ? 'Undoing...' : 'Undo'}
                  </button>
                </div>
              );
            })}
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

      <div className="space-y-12">
        {taskDisplayMode === 'list' ? (
          <ParentTaskBoard
            tasks={tasks}
            categories={categories}
            kids={kids}
            selectedCategoryId={selectedCategoryId}
            onArchiveTask={archiveTask}
            onEditTask={setEditingTask}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            isLocked={isLocked}
            isDarkMode={isDarkMode}
            onOpenCategories={() => setIsManagingCategories(true)}
            onOpenAddTask={() => setIsAddingTask(true)}
            onCategoriesChange={onCategoriesChange}
          />
        ) : (
          <ChoreChart
            tasks={tasks}
            kids={kids}
            categories={categories}
          />
        )}

        <div className="pt-8 border-t border-ui">
          <HomeworkView parentId={parentId} kids={kids} userRole="parent" />
        </div>
      </div>

      {isAddingTask && (
        <AddTaskModal
          onClose={() => setIsAddingTask(false)}
          onSubmit={addTask}
          kids={kids}
          categories={categories}
          parentId={parentId}
          existingTasks={tasks}
        />
      )}

      {editingTask && (
        <AddTaskModal
          onClose={() => setEditingTask(null)}
          onSubmit={(data) => editTask(editingTask.id, data)}
          kids={kids}
          categories={categories}
          parentId={parentId}
          initialTask={editingTask}
          existingTasks={tasks}
          modalTitle="Edit Mission"
          submitLabel="Save Changes"
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
