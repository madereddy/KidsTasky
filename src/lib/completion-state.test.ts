// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildTaskCompletionId,
  findTaskCompletion,
  getHomeworkCompletionState,
  getTaskCompletionState,
  isAwardedTaskCompletion,
  isTaskCompleted,
  normalizeTaskSlot,
  removeTaskCompletion,
  splitHomeworkByCompletion,
  upsertTaskCompletion,
} from './completion-state';
import { Homework, TaskCompletion } from '../types';

describe('completion-state helpers', () => {
  const completions: TaskCompletion[] = [
    { id: 't1_2026-06-03_1', taskId: 't1', kidId: 'k1', completedAt: 1, dateString: '2026-06-03', approvalStatus: null },
    { id: 't2_2026-06-03_2', taskId: 't2', kidId: 'k1', completedAt: 1, dateString: '2026-06-03', count: 2, approvalStatus: 'pending' },
  ];

  it('normalizes empty slots to slot 1 and builds deterministic ids', () => {
    expect(normalizeTaskSlot(undefined)).toBe(1);
    expect(normalizeTaskSlot(null)).toBe(1);
    expect(buildTaskCompletionId('taskA', '2026-06-03')).toBe('taskA_2026-06-03_1');
    expect(buildTaskCompletionId('taskA', '2026-06-03', 2)).toBe('taskA_2026-06-03_2');
  });

  it('finds and matches completions with null or undefined slot counts', () => {
    expect(findTaskCompletion(completions, 't1')).toMatchObject({ id: 't1_2026-06-03_1' });
    expect(isTaskCompleted(completions, 't1', 1)).toBe(true);
    expect(isTaskCompleted(completions, 't2', 2)).toBe(true);
    expect(isTaskCompleted(completions, 't2', 1)).toBe(false);
  });

  it('derives awarded and display state from approval status consistently', () => {
    expect(isAwardedTaskCompletion(undefined)).toBe(true);
    expect(isAwardedTaskCompletion({ approvalStatus: null })).toBe(true);
    expect(isAwardedTaskCompletion({ approvalStatus: 'approved' })).toBe(true);
    expect(isAwardedTaskCompletion({ approvalStatus: 'pending' })).toBe(false);
    expect(getTaskCompletionState(undefined)).toBe('todo');
    expect(getTaskCompletionState({ approvalStatus: null })).toBe('completed');
    expect(getTaskCompletionState({ approvalStatus: 'pending' })).toBe('pending');
    expect(getTaskCompletionState({ approvalStatus: 'rejected' })).toBe('rejected');
    expect(getTaskCompletionState({ approvalStatus: 'skipped' })).toBe('skipped');
  });

  it('upserts and removes task completions by task slot identity', () => {
    const next = upsertTaskCompletion(completions, {
      id: 't2_2026-06-03_2',
      taskId: 't2',
      kidId: 'k1',
      completedAt: 2,
      dateString: '2026-06-03',
      count: 2,
      approvalStatus: 'approved',
    });
    expect(next).toHaveLength(2);
    expect(findTaskCompletion(next, 't2', 2)?.approvalStatus).toBe('approved');
    expect(removeTaskCompletion(next, 't2', 2)).toHaveLength(1);
  });

  it('splits homework into pending and completed sections from one shared rule', () => {
    const homework: Homework[] = [
      { id: 'h1', parentId: 'p1', title: 'Math', subject: 'Math', dueDate: '2026-06-03', status: 'pending', color: '#fff', createdAt: 1 },
      { id: 'h2', parentId: 'p1', title: 'Read', subject: 'ELA', dueDate: '2026-06-03', status: 'done', color: '#fff', createdAt: 1 },
    ];
    expect(getHomeworkCompletionState(homework[0])).toBe('pending');
    expect(getHomeworkCompletionState(homework[1])).toBe('done');
    const split = splitHomeworkByCompletion(homework);
    expect(split.pending.map((item) => item.id)).toEqual(['h1']);
    expect(split.completed.map((item) => item.id)).toEqual(['h2']);
  });
});
