import { Homework, TaskCompletion } from '../types';

export const DEFAULT_TASK_SLOT = 1;

export type TaskCompletionState = 'todo' | 'completed' | 'pending' | 'rejected' | 'skipped';
export type HomeworkCompletionState = 'pending' | 'done';

export function normalizeTaskSlot(count?: number | null): number {
  return count ?? DEFAULT_TASK_SLOT;
}

export function buildTaskCompletionId(taskId: string, dateString: string, count?: number | null): string {
  return `${taskId}_${dateString}_${normalizeTaskSlot(count)}`;
}

export function sameTaskCompletionSlot(
  completion: Pick<TaskCompletion, 'taskId' | 'count'>,
  taskId: string,
  count?: number | null,
): boolean {
  return completion.taskId === taskId && normalizeTaskSlot(completion.count) === normalizeTaskSlot(count);
}

export function findTaskCompletion(
  completions: TaskCompletion[],
  taskId: string,
  count?: number | null,
): TaskCompletion | undefined {
  return completions.find((completion) => sameTaskCompletionSlot(completion, taskId, count));
}

export function isTaskCompleted(
  completions: TaskCompletion[],
  taskId: string,
  count?: number | null,
): boolean {
  return Boolean(findTaskCompletion(completions, taskId, count));
}

export function isAwardedTaskCompletion(completion?: Pick<TaskCompletion, 'approvalStatus'> | null): boolean {
  return !completion?.approvalStatus || completion.approvalStatus === 'approved';
}

export function getTaskCompletionState(completion?: Pick<TaskCompletion, 'approvalStatus'> | null): TaskCompletionState {
  if (!completion) return 'todo';
  if (completion.approvalStatus === 'pending') return 'pending';
  if (completion.approvalStatus === 'rejected') return 'rejected';
  if (completion.approvalStatus === 'skipped') return 'skipped';
  return 'completed';
}

export function upsertTaskCompletion(completions: TaskCompletion[], nextCompletion: TaskCompletion): TaskCompletion[] {
  const remaining = completions.filter(
    (completion) => !sameTaskCompletionSlot(completion, nextCompletion.taskId, nextCompletion.count),
  );
  return [...remaining, nextCompletion];
}

export function removeTaskCompletion(
  completions: TaskCompletion[],
  taskId: string,
  count?: number | null,
): TaskCompletion[] {
  return completions.filter((completion) => !sameTaskCompletionSlot(completion, taskId, count));
}

export function getHomeworkCompletionState(homework: Pick<Homework, 'status'>): HomeworkCompletionState {
  return homework.status === 'done' ? 'done' : 'pending';
}

export function splitHomeworkByCompletion<T extends Pick<Homework, 'status'>>(items: T[]): {
  pending: T[];
  completed: T[];
} {
  const pending: T[] = [];
  const completed: T[] = [];

  for (const item of items) {
    if (getHomeworkCompletionState(item) === 'done') {
      completed.push(item);
    } else {
      pending.push(item);
    }
  }

  return { pending, completed };
}
