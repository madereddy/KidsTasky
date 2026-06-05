// src/hooks/useMissionTodayController.ts
import { useMemo } from 'react';
import { isToday } from 'date-fns';
import { MissionItem, UserProfile, Task, CalendarEvent, AppListItem, Category, TaskCompletion, AppList } from '../types';
import { HouseholdLocationOption } from '../lib/householdListPreferences';

interface UseMissionTodayOptions {
  profile: UserProfile;
  tasks: Task[];
  events: CalendarEvent[];
  completions: TaskCompletion[];
  listItems: AppListItem[];
  lists: AppList[];
  kids: UserProfile[];
  categories: Category[];
  storeNames?: string[];
  locationOptions?: HouseholdLocationOption[];
}

export function useMissionTodayController({ 
  profile, 
  tasks = [], 
  events = [], 
  completions = [], 
  listItems = [], 
  lists = [], 
  kids = [], 
  categories = [],
  storeNames = [],
  locationOptions = []
}: UseMissionTodayOptions) {
  const missionItems = useMemo(() => {
    const items: MissionItem[] = [];

    // 1. Process Tasks
    tasks.forEach(task => {
      const isAssigned = task.assignedKidId === profile.uid || profile.role === 'parent';
      if (!isAssigned || task.status === 'archived') return;

      const taskCompletions = completions.filter(c => c.taskId === task.id && c.approvalStatus !== 'rejected');
      const requiredCount = task.frequency === 'twice-daily' ? 2 : 1;
      const fullyCompletedCount = taskCompletions.filter(c => 
        !task.requiresApproval || c.approvalStatus === 'approved' || c.approvalStatus === 'skipped'
      ).length;

      if (fullyCompletedCount >= requiredCount) return;

      const category = categories.find(c => c.id === task.categoryId);
      const hasPendingApproval = task.requiresApproval && taskCompletions.some(c => c.approvalStatus === 'pending');

      items.push({
        id: `task_${task.id}`,
        type: 'task',
        title: task.title,
        subtitle: task.requiresApproval ? 'Needs approval' : undefined,
        time: task.reminderTime,
        status: hasPendingApproval ? 'needs_approval' : 'pending',
        color: category?.color || undefined,
        originalData: task,
        assignedToId: task.assignedKidId
      });
    });

    // 2. Process Events (Today only)
    events.forEach(event => {
      if (!isToday(new Date(event.startTime))) return;

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

    // 3. Process List Items & Routines
    listItems.forEach(item => {
      if (item.completed) return;
      
      const parentList = lists.find(l => l.id === item.listId);
      if (!parentList || parentList.category !== 'routine' || !parentList.isRoutine) return;
      
      // Extract store/location from text or parent list
      const storeName = storeNames.find(store => 
        item.text.toLowerCase().includes(store.toLowerCase())
      ) || parentList?.locationName;

      const locationName = locationOptions.find(loc => 
        item.text.toLowerCase().includes(loc.label.toLowerCase())
      )?.label || item.locationName || parentList?.locationName;

      items.push({
        id: `list_${item.id}`,
        type: 'list_item',
        title: item.text,
        status: 'pending',
        storeName: storeName as string,
        locationName: locationName as string,
        listCategory: parentList?.category,
        originalData: item
      });
    });

    // 4. Process Routines themselves (as summaries)
    lists.forEach(list => {
      if (!list.isRoutine || list.category !== 'routine') return;
      
      const routineItems = listItems.filter(i => i.listId === list.id && !i.completed);
      if (routineItems.length === 0) return;

      items.push({
        id: `routine_${list.id}`,
        type: 'routine',
        title: list.title,
        subtitle: `${routineItems.length} items remaining`,
        status: 'pending',
        locationName: list.locationName,
        listCategory: list.category,
        originalData: list
      });
    });

    // Deduplicate by ID
    const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());

    return uniqueItems.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  }, [profile, tasks, events, completions, listItems, lists, categories, storeNames, locationOptions]);

  return { missionItems };
}
