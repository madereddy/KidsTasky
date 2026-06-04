// src/hooks/useMissionTodayController.ts
import { useMemo } from 'react';
import { MissionItem, UserProfile, Task, CalendarEvent, AppListItem } from '../types';

interface UseMissionTodayOptions {
  profile: UserProfile;
  tasks: Task[];
  events: CalendarEvent[];
  listItems: AppListItem[];
  kids: UserProfile[];
}

export function useMissionTodayController({ profile, tasks, events, listItems, kids }: UseMissionTodayOptions) {
  const missionItems = useMemo(() => {
    const items: MissionItem[] = [];

    // 1. Process Tasks
    tasks.forEach(task => {
      const isAssigned = task.assignedKidId === profile.uid || profile.role === 'parent';
      if (!isAssigned || task.status === 'archived') return;

      items.push({
        id: `task_${task.id}`,
        type: 'task',
        title: task.title,
        subtitle: task.requiresApproval ? 'Needs approval' : undefined,
        status: task.requiresApproval ? 'needs_approval' : 'pending',
        color: task.categoryId ? 'bg-sky-500' : undefined,
        originalData: task,
        assignedToId: task.assignedKidId
      });
    });

    // 2. Process Events (Today only)
    const today = new Date().toISOString().split('T')[0];
    events.forEach(event => {
      const eventDate = new Date(event.startTime).toISOString().split('T')[0];
      if (eventDate !== today) return;

      items.push({
        id: `event_${event.id}`,
        type: 'event',
        title: event.title,
        time: new Date(event.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        color: event.color,
        originalData: event
      });
    });

    // 3. Process List Items (Grocery focus)
    listItems.forEach(item => {
      if (item.completed) return;
      items.push({
        id: `list_${item.id}`,
        type: 'list_item',
        title: item.text,
        status: 'pending',
        originalData: item
      });
    });

    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [profile, tasks, events, listItems]);

  return { missionItems };
}
