import { useEffect, useState } from 'react';
import { format, startOfToday, subDays } from 'date-fns';
import { BADGE_DEFS } from '../constants';
import { userService } from '../services/users';
import { tasksClientService } from '../services/tasks';
import { BadgeDef, Task, TaskCompletion, UserProfile } from '../types';

interface UseKidMilestonesOptions {
  profile: UserProfile;
  tasks: Task[];
  completions: TaskCompletion[];
  localXp: number;
  streak: number;
  loading: boolean;
  today: string;
  onProfileUpdate: () => void;
}

export function useKidMilestones({
  profile,
  tasks,
  completions,
  localXp,
  streak,
  loading,
  today,
  onProfileUpdate,
}: UseKidMilestonesOptions) {
  const [unlockedBadge, setUnlockedBadge] = useState<BadgeDef | null>(null);

  useEffect(() => {
    const checkMilestones = async () => {
      if (loading) return;
      const earnedIds = (profile.badges || []).map((badge) => badge.id);

      if (!earnedIds.includes('first_mission') && completions.length > 0) {
        await userService.addBadge(profile.uid, 'first_mission');
        setUnlockedBadge(BADGE_DEFS.first_mission);
        onProfileUpdate();
      }

      if (!earnedIds.includes('xp_100') && localXp >= 100) {
        await userService.addBadge(profile.uid, 'xp_100');
        setUnlockedBadge(BADGE_DEFS.xp_100);
        onProfileUpdate();
      }

      if (!earnedIds.includes('streak_7') && streak >= 7) {
        await userService.addBadge(profile.uid, 'streak_7');
        setUnlockedBadge(BADGE_DEFS.streak_7);
        onProfileUpdate();
      }
    };

    void checkMilestones();
  }, [completions.length, loading, localXp, onProfileUpdate, profile.badges, profile.uid, streak]);

  useEffect(() => {
    const checkHardMilestone = async () => {
      if (tasks.length === 0) return;
      const startDate = format(subDays(startOfToday(), 30), 'yyyy-MM-dd');
      const histCompletions = await tasksClientService.getCompletionsForDateRange(profile.uid, startDate, today);
      const earnedIds = (profile.badges || []).map((badge) => badge.id);
      if (!earnedIds.includes('hard_master')) {
        const hardTaskIds = tasks.filter((task) => task.difficulty === 'hard').map((task) => task.id);
        const hardCount = histCompletions.filter((completion) => hardTaskIds.includes(completion.taskId)).length;
        if (hardCount >= 5) {
          await userService.addBadge(profile.uid, 'hard_master');
          setUnlockedBadge(BADGE_DEFS.hard_master);
          onProfileUpdate();
        }
      }
    };

    void checkHardMilestone();
  }, [onProfileUpdate, profile.badges, profile.uid, tasks, today]);

  return {
    unlockedBadge,
    dismissUnlockedBadge: () => setUnlockedBadge(null),
  };
}
