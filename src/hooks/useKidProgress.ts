import { useEffect, useMemo, useState } from 'react';
import { addHours, differenceInDays, format, isAfter, parse, startOfDay, startOfToday, subDays } from 'date-fns';
import { Task, TaskCompletion } from '../types';
import { parseTimestamp } from '../lib/utils';
import { tasksClientService } from '../services/tasks';

interface UseKidProgressOptions {
  tasks: Task[];
  completions: TaskCompletion[];
  profileUid: string;
  today: string;
  selectedCategoryId: string | null;
  sortBy: 'time' | 'created';
}

export function useKidProgress({
  tasks,
  completions,
  profileUid,
  today,
  selectedCategoryId,
  sortBy,
}: UseKidProgressOptions) {
  const [streak, setStreak] = useState(0);

  const shouldShowToday = (task: Task) => {
    if (task.frequency === 'daily' || task.frequency === 'twice-daily') return true;
    if (task.frequency === 'weekdays') {
      const day = new Date().getDay();
      return day >= 1 && day <= 5;
    }

    const createdDate = parseTimestamp(task.createdAt);
    const daysSinceCreated = differenceInDays(startOfToday(), startOfDay(createdDate));

    if (task.frequency === 'weekly') return daysSinceCreated % 7 === 0;
    if (task.frequency === 'bi-weekly') return daysSinceCreated % 14 === 0;
    if (task.frequency === 'custom' && task.customInterval) return daysSinceCreated % task.customInterval === 0;

    return false;
  };

  const isCompleted = (taskId: string) => completions.some((completion) => completion.taskId === taskId);

  const filteredTasks = useMemo(() => {
    const visibleTasks = selectedCategoryId
      ? tasks.filter((task) => task.categoryId === selectedCategoryId && shouldShowToday(task))
      : tasks.filter((task) => shouldShowToday(task));

    return [...visibleTasks].sort((a, b) => {
      if (sortBy === 'time') {
        const timeA = a.reminderTime || '99:99';
        const timeB = b.reminderTime || '99:99';
        return timeA.localeCompare(timeB);
      }
      return parseTimestamp(b.createdAt).getTime() - parseTimestamp(a.createdAt).getTime();
    });
  }, [selectedCategoryId, sortBy, tasks]);

  const todayTasks = useMemo(
    () => tasks.filter((task) => shouldShowToday(task)),
    [tasks],
  );

  const totalSlots = useMemo(
    () => todayTasks.reduce((acc, task) => acc + (task.frequency === 'twice-daily' ? 2 : 1), 0),
    [todayTasks],
  );

  const todayCompletions = useMemo(
    () => completions.filter((completion) => completion.dateString === today),
    [completions, today],
  );

  const progressPercent = totalSlots > 0 ? (todayCompletions.length / totalSlots) * 100 : 0;

  const getUrgency = (task: Task) => {
    if (!task.reminderTime || isCompleted(task.id)) return 'none';
    const now = new Date();
    const reminder = parse(task.reminderTime, 'HH:mm', now);
    if (isAfter(now, reminder)) return 'overdue';
    if (isAfter(now, addHours(reminder, -1))) return 'soon';
    return 'none';
  };

  useEffect(() => {
    const calculateStreak = async () => {
      if (tasks.length === 0 || totalSlots === 0) {
        setStreak(0);
        return;
      }

      const startDate = format(subDays(startOfToday(), 30), 'yyyy-MM-dd');
      const histCompletions = (await tasksClientService.getCompletionsForDateRange(profileUid, startDate, today)) || [];

      let currentStreak = 0;
      let checkDate = startOfToday();
      const compsByDate: Record<string, number> = {};

      histCompletions.forEach((completion) => {
        compsByDate[completion.dateString] = (compsByDate[completion.dateString] || 0) + 1;
      });
      compsByDate[today] = completions.length;

      for (let i = 0; i < 30; i += 1) {
        const dateString = format(checkDate, 'yyyy-MM-dd');
        const completionsForDay = compsByDate[dateString] || 0;

        if (completionsForDay >= totalSlots) {
          currentStreak += 1;
        } else if (i > 0) {
          break;
        }

        checkDate = subDays(checkDate, 1);
      }

      setStreak(currentStreak);
    };

    void calculateStreak();
  }, [completions.length, profileUid, tasks, today, totalSlots]);

  return {
    streak,
    shouldShowToday,
    filteredTasks,
    todayTasks,
    totalSlots,
    todayCompletions,
    progressPercent,
    getUrgency,
  };
}
