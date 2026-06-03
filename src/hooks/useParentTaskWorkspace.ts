import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Task, TaskCompletion, UserProfile } from '../types';
import { tasksClientService } from '../services/tasks';
import { dashboardClientService } from '../services/dashboard';
import { isAwardedTaskCompletion } from '../lib/completion-state';
import { removeEntityById, upsertEntityByIdSorted } from '../lib/entity-list';

export interface ParentCompletionSummary extends TaskCompletion {
  kidName: string;
  taskTitle?: string;
}

interface UseParentTaskWorkspaceOptions {
  parentId: string;
  kids: UserProfile[];
}

export function useParentTaskWorkspace({ parentId, kids }: UseParentTaskWorkspaceOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingCompletions, setPendingCompletions] = useState<ParentCompletionSummary[]>([]);
  const [todayApprovedCompletions, setTodayApprovedCompletions] = useState<ParentCompletionSummary[]>([]);
  
  const memoKids = useMemo(() => JSON.stringify(kids), [kids]);

  const compareCompletionRecency = (left: ParentCompletionSummary, right: ParentCompletionSummary) => {
    const leftTime = typeof left.completedAt === 'number' ? left.completedAt : (left.completedAt?.seconds || 0);
    const rightTime = typeof right.completedAt === 'number' ? right.completedAt : (right.completedAt?.seconds || 0);
    return Number(rightTime) - Number(leftTime);
  };

  const loadWorkspace = useCallback(async () => {
    console.log('[useParentTaskWorkspace] loadWorkspace started');
    const today = format(new Date(), 'yyyy-MM-dd');
    const parsedKids = JSON.parse(memoKids) as UserProfile[];
    
    try {
      console.log('[useParentTaskWorkspace] Fetching family dashboard data...');
      const dashboardData = await dashboardClientService.getFamilyDashboardData(parentId, today);
      console.log('[useParentTaskWorkspace] dashboardData received:', !!dashboardData);

      const taskList = dashboardData.tasks || [];
      
      const completedToday = dashboardData.completions
        .filter((row) => isAwardedTaskCompletion(row))
        .map((row) => {
          const kid = parsedKids.find(k => k.uid === row.kidId);
          return {
            ...row,
            kidName: kid?.name || 'Unknown',
            taskTitle: taskList.find((task) => task.id === row.taskId)?.title,
          };
        })
        .sort(compareCompletionRecency);

      setTasks(taskList);
      
      console.log('[useParentTaskWorkspace] Fetching pending completions...');
      const pendingRows = await tasksClientService.getPendingCompletions(parentId).catch(() => []);
      console.log('[useParentTaskWorkspace] pendingRows received:', pendingRows?.length);

      setPendingCompletions((pendingRows || []) as ParentCompletionSummary[]);
      setTodayApprovedCompletions(completedToday);
      console.log('[useParentTaskWorkspace] loadWorkspace successfully finished');
    } catch (err) {
      console.error('[useParentTaskWorkspace] loadWorkspace caught error:', err);
      throw err;
    }
  }, [memoKids, parentId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    const payload = task as any;
    const selectedKidIds: string[] = Array.isArray(payload.assignedKidIds)
      ? payload.assignedKidIds.filter(Boolean)
      : [];

    if (selectedKidIds.length > 1) {
      await Promise.all(
        selectedKidIds.map((kidId) =>
          tasksClientService.createTask({ ...payload, assignedKidId: kidId }),
        ),
      );
    } else {
      await tasksClientService.createTask({
        ...payload,
        assignedKidId: selectedKidIds[0] || payload.assignedKidId,
      });
    }

    await loadWorkspace();
  };

  const archiveTask = async (taskId: string) => {
    await tasksClientService.archiveTask(taskId);
    setTasks((prev) => removeEntityById(prev, taskId));
  };

  const editTask = async (taskId: string, patch: Partial<Task>) => {
    await tasksClientService.updateTask(taskId, patch);
    await loadWorkspace();
  };

  const approveCompletion = async (completionId: string) => {
    await tasksClientService.approveCompletion(completionId);
    setPendingCompletions((prev) => {
      const approved = prev.find((completion) => completion.id === completionId);
      if (approved) {
        setTodayApprovedCompletions((current) => upsertEntityByIdSorted(current, {
          ...approved,
          approvalStatus: 'approved',
          taskTitle: approved.taskTitle || tasks.find((task) => task.id === approved.taskId)?.title,
        }, compareCompletionRecency));
      }
      return removeEntityById(prev, completionId);
    });
  };

  const rejectCompletion = async (completionId: string) => {
    await tasksClientService.rejectCompletion(completionId);
    setPendingCompletions((prev) => removeEntityById(prev, completionId));
  };

  const undoCompletion = async (completion: ParentCompletionSummary) => {
    await tasksClientService.uncompleteTask(completion.taskId, completion.dateString, completion.count ?? undefined);
    setTodayApprovedCompletions((prev) => removeEntityById(prev, completion.id));
  };

  return {
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
  };
}
