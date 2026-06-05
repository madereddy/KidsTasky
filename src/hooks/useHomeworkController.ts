import { useCallback, useEffect, useMemo, useState } from 'react';
import { Homework, UserProfile } from '../types';
import { homeworkClientService } from '../services/homework';
import { getHomeworkCompletionState, splitHomeworkByCompletion } from '../lib/completion-state';
import { removeEntityById, sortEntities, upsertEntityByIdSorted } from '../lib/entity-list';
import { useAsyncActionMap } from './useAsyncActionMap';
import { useCelebration } from './useCelebration';

export interface HomeworkProofPrompt {
  item: Homework;
  questions: string[];
}

interface UseHomeworkControllerOptions {
  parentId: string;
  kids: UserProfile[];
  userRole: 'parent' | 'kid' | 'coparent';
  currentUserId?: string;
}

export function useHomeworkController({
  parentId,
  kids,
  userRole,
  currentUserId,
}: UseHomeworkControllerOptions) {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [proofPrompt, setProofPrompt] = useState<HomeworkProofPrompt | null>(null);
  const [proofAnswers, setProofAnswers] = useState<Record<string, string>>({});
  const homeworkActions = useAsyncActionMap();
  const { celebrationTick, celebrate } = useCelebration();

  const compareHomework = (a: Homework, b: Homework) => {
    const dueDateCompare = String(a.dueDate).localeCompare(String(b.dueDate));
    if (dueDateCompare !== 0) return dueDateCompare;
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await homeworkClientService.getHomework(parentId);
      setHomework(sortEntities(rows || [], compareHomework));
    } catch {
      setLoadError('Could not load homework right now.');
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleHomework = useMemo(() => {
    if (userRole === 'parent' || userRole === 'coparent') return homework;
    return homework.filter((item) => !item.assignedToId || item.assignedToId === currentUserId);
  }, [currentUserId, homework, userRole]);

  const { pending: pendingHomework, completed: completedHomework } = useMemo(
    () => splitHomeworkByCompletion(visibleHomework),
    [visibleHomework],
  );

  const getAssigneeName = (item: Homework) =>
    item.assignedToId ? kids.find((kid) => kid.uid === item.assignedToId)?.name || 'Assigned' : 'All kids';

  const getActiveQuestions = (item: Homework): string[] => {
    const questions = Array.isArray(item.completionQuestions) ? item.completionQuestions.filter(Boolean) : [];
    if (questions.length === 0) return [];
    if (!item.completionQuestionsKidId) return questions;
    return item.completionQuestionsKidId === currentUserId ? questions : [];
  };

  const buildHomeworkResponse = (questions: string[]) =>
    questions
      .map((question, index) => ({ question, answer: String(proofAnswers[`q_${index}`] || '').trim() }))
      .filter((pair) => pair.answer.length > 0)
      .map((pair) => `${pair.question} ${pair.answer}`)
      .join('\n');

  const updateHomeworkStatus = async (
    item: Homework,
    nextStatus: 'pending' | 'done',
    completionResponse: string | null = null,
  ) => {
    await homeworkActions.run(item.id, async () => {
      const result = await homeworkClientService.updateHomework(item.id, { status: nextStatus, completionResponse });
      if (result.homework) {
        setHomework((prev) => upsertEntityByIdSorted(prev, result.homework!, compareHomework));
      } else {
        await load();
      }
      if (nextStatus === 'done') celebrate();
    });
  };

  const handleHomeworkToggle = async (item: Homework) => {
    const currentState = getHomeworkCompletionState(item);
    const nextStatus = currentState === 'done' ? 'pending' : 'done';
    const questions = nextStatus === 'done' && userRole === 'kid' ? getActiveQuestions(item) : [];
    if (questions.length > 0) {
      setProofAnswers({});
      setProofPrompt({ item, questions });
      return;
    }
    await updateHomeworkStatus(item, nextStatus, null);
  };

  const submitProofPrompt = async () => {
    if (!proofPrompt) return;
    const response = buildHomeworkResponse(proofPrompt.questions);
    if (!response.trim()) return;
    await updateHomeworkStatus(proofPrompt.item, 'done', response);
    setProofPrompt(null);
    setProofAnswers({});
  };

  const deleteHomework = async (itemId: string) => {
    await homeworkActions.run(itemId, async () => {
      await homeworkClientService.deleteHomework(itemId);
      setHomework((prev) => removeEntityById(prev, itemId));
    });
  };

  const createHomework = async (payload: Omit<Homework, 'id' | 'createdAt'>) => {
    const created = await homeworkClientService.createHomework(payload);
    setHomework((prev) => upsertEntityByIdSorted(prev, created, compareHomework));
  };

  const editHomework = async (itemId: string, payload: Partial<Homework>) => {
    const result = await homeworkClientService.updateHomework(itemId, payload);
    if (result.homework) {
      setHomework((prev) => upsertEntityByIdSorted(prev, result.homework!, compareHomework));
      return;
    }
    await load();
  };

  return {
    homework,
    visibleHomework,
    pendingHomework,
    completedHomework,
    loading,
    loadError,
    load,
    proofPrompt,
    setProofPrompt,
    proofAnswers,
    setProofAnswers,
    celebrationTick,
    isHomeworkPending: homeworkActions.isPending,
    getHomeworkCompletionState,
    getAssigneeName,
    handleHomeworkToggle,
    updateHomeworkStatus,
    submitProofPrompt,
    deleteHomework,
    createHomework,
    editHomework,
  };
}
