import { useEffect, useState } from 'react';
import { Task, TaskCompletion, UserProfile } from '../types';
import { tasksClientService } from '../services/tasks';
import { XP_REWARDS } from '../constants';
import {
  buildTaskCompletionId,
  findTaskCompletion,
  isAwardedTaskCompletion,
  isTaskCompleted,
  removeTaskCompletion,
  upsertTaskCompletion,
} from '../lib/completion-state';
import { useAsyncActionMap } from './useAsyncActionMap';
import { useCelebration } from './useCelebration';
import { clientLogger } from '../services/clientLogger';

export interface ConfirmTaskState {
  taskId: string;
  count?: number;
  xpReward: number;
  taskTitle: string;
  questions?: string[];
}

interface UseTaskCompletionControllerOptions {
  profile: UserProfile;
  tasks: Task[];
  today: string;
  onProfileUpdate: () => void;
}

export function useTaskCompletionController({
  profile,
  tasks,
  today,
  onProfileUpdate,
}: UseTaskCompletionControllerOptions) {
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [confirmTask, setConfirmTask] = useState<ConfirmTaskState | null>(null);
  const [proofAnswers, setProofAnswers] = useState<Record<string, string>>({});
  const [xpAnimation, setXpAnimation] = useState<{ amount: number; active: boolean }>({ amount: 0, active: false });
  const [showStarBurst, setShowStarBurst] = useState(false);
  const [starsAwarded, setStarsAwarded] = useState(0);
  const [localXp, setLocalXp] = useState(profile.xp || 0);
  const taskActions = useAsyncActionMap();
  const { celebrationTick, celebrate } = useCelebration();

  useEffect(() => {
    setLocalXp(profile.xp || 0);
  }, [profile.xp]);

  const getCompletion = (taskId: string, count?: number) => findTaskCompletion(completions, taskId, count);
  const isCompleted = (taskId: string, count?: number) => isTaskCompleted(completions, taskId, count);
  const isTaskPending = (taskId: string, count?: number) => taskActions.isPending(`${taskId}_${count || 1}`);

  const completeTaskNow = async (
    taskId: string,
    count: number | undefined,
    xpReward: number,
    questions: string[],
    answers: Record<string, string>,
  ) => {
    const key = `${taskId}_${count || 1}`;
    const task = tasks.find((candidate) => candidate.id === taskId);
    const stars = task?.starValue ?? 1;

    await taskActions.run(key, async () => {
      const proofPayload = questions
        .map((question, index) => ({ question, answer: String(answers[`q_${index}`] || '').trim() }))
        .filter((entry) => entry.answer.length > 0);
      const result = await tasksClientService.completeTask(
        taskId,
        profile.uid,
        today,
        count,
        proofPayload.length > 0 ? proofPayload : undefined,
      );
      if (result && result.created === false) return;

      const isPending = result?.approvalStatus === 'pending';
      setCompletions((prev) => upsertTaskCompletion(prev, {
        id: buildTaskCompletionId(taskId, today, count),
        taskId,
        kidId: profile.uid,
        completedAt: { seconds: Date.now() / 1000 },
        dateString: today,
        count,
        approvalStatus: result?.approvalStatus,
      }));

      if (!isPending) {
        setXpAnimation({ amount: xpReward, active: true });
        setStarsAwarded(stars);
        setShowStarBurst(true);
        setTimeout(() => setShowStarBurst(false), 1200);
        setLocalXp((prev) => prev + xpReward);
        celebrate();
      }

      onProfileUpdate();
    }).catch((error) => {
      clientLogger.errorWithException('task_completion_failed', error, { taskId, kidId: profile.uid, count });
      setXpAnimation({ amount: 0, active: false });
      alert('Could not save completion. Please try again.');
    }).finally(() => {
      setTimeout(() => {
        setXpAnimation({ amount: 0, active: false });
      }, 2500);
    });
  };

  const toggleTask = async (
    taskId: string,
    currentStatus: boolean,
    count: number | undefined,
    isTaskLocked: (task: Task) => boolean,
  ) => {
    const key = `${taskId}_${count || 1}`;
    if (taskActions.isPending(key)) return;

    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    if (isTaskLocked(task) && !currentStatus) return;

    const xpReward = XP_REWARDS[task.difficulty || 'easy'];

    if (currentStatus) {
      const existing = getCompletion(taskId, count);
      const xpWasAwarded = isAwardedTaskCompletion(existing);
      await taskActions.run(key, async () => {
        await tasksClientService.uncompleteTask(taskId, today, count);
        setCompletions((prev) => removeTaskCompletion(prev, taskId, count));
        if (xpWasAwarded) setLocalXp((prev) => Math.max(0, prev - xpReward));
        onProfileUpdate();
      });
      return;
    }

    const questions = Array.isArray(task.completionQuestions) ? task.completionQuestions.filter(Boolean) : [];
    const scopedQuestions = (!task.completionQuestionsKidId || task.completionQuestionsKidId === profile.uid)
      ? questions
      : [];

    if (scopedQuestions.length === 0) {
      await completeTaskNow(taskId, count, xpReward, [], {});
      return;
    }

    setProofAnswers({});
    setConfirmTask({
      taskId,
      count,
      xpReward,
      taskTitle: task.title,
      questions: scopedQuestions,
    });
  };

  const skipTask = async (taskId: string, count?: number) => {
    const key = `${taskId}_${count || 1}`;
    try {
      await taskActions.run(key, async () => {
        await tasksClientService.skipTask(taskId, profile.uid, today, count);
        setCompletions((prev) => upsertTaskCompletion(prev, {
          id: buildTaskCompletionId(taskId, today, count),
          taskId,
          kidId: profile.uid,
          completedAt: { seconds: Date.now() / 1000 },
          dateString: today,
          count,
          approvalStatus: 'skipped',
        }));
      });
    } catch (error) {
      clientLogger.errorWithException('task_skip_failed', error, { taskId, kidId: profile.uid, count });
      alert('Could not skip task. Please try again.');
    }
  };

  const executeCompletion = async () => {
    if (!confirmTask) return;
    const { taskId, count, xpReward, questions = [] } = confirmTask;
    setConfirmTask(null);
    await completeTaskNow(taskId, count, xpReward, questions, proofAnswers);
  };

  return {
    completions,
    setCompletions,
    localXp,
    setLocalXp,
    confirmTask,
    setConfirmTask,
    proofAnswers,
    setProofAnswers,
    xpAnimation,
    showStarBurst,
    starsAwarded,
    celebrationTick,
    getCompletion,
    isCompleted,
    isTaskPending,
    toggleTask,
    skipTask,
    executeCompletion,
  };
}
