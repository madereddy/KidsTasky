// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMissionTodayController } from './useMissionTodayController';
import { UserProfile, Task, CalendarEvent, AppListItem } from '../types';

describe('useMissionTodayController', () => {
  const mockProfile: UserProfile = {
    uid: 'kid1',
    role: 'kid',
    name: 'Kid One',
    email: 'kid1@example.com',
  };

  const mockTasks: Task[] = [
    {
      id: 'task1',
      title: 'Brush Teeth',
      assignedKidId: 'kid1',
      parentId: 'parent1',
      status: 'active',
      frequency: 'daily',
      createdAt: Date.now(),
    },
    {
      id: 'task2',
      title: 'Make Bed',
      assignedKidId: 'kid2',
      parentId: 'parent1',
      status: 'active',
      frequency: 'daily',
      createdAt: Date.now(),
    }
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  const mockEvents: CalendarEvent[] = [
    {
      id: 'event1',
      parentId: 'parent1',
      title: 'Soccer Practice',
      description: 'Practice at the park',
      startTime: new Date(`${todayStr}T15:00:00`).getTime(),
      endTime: new Date(`${todayStr}T16:00:00`).getTime(),
      color: '#sky-500',
    },
    {
      id: 'event2',
      parentId: 'parent1',
      title: 'Future Event',
      description: 'Not today',
      startTime: new Date('2099-01-01T10:00:00').getTime(),
      endTime: new Date('2099-01-01T11:00:00').getTime(),
      color: '#sky-500',
    }
  ];

  const mockListItems: AppListItem[] = [
    { id: 'list1', listId: 'l1', text: 'Milk', completed: 0 },
    { id: 'list2', listId: 'l1', text: 'Bread', completed: 1 },
  ];

  const mockKids: UserProfile[] = [mockProfile];

  it('filters and transforms tasks for the active kid', () => {
    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: mockTasks,
      events: [],
      listItems: [],
      kids: mockKids
    }));

    expect(result.current.missionItems).toHaveLength(1);
    expect(result.current.missionItems[0]).toMatchObject({
      id: 'task_task1',
      type: 'task',
      title: 'Brush Teeth',
      status: 'pending',
    });
  });

  it('filters events to show only today', () => {
    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [],
      events: mockEvents,
      listItems: [],
      kids: mockKids
    }));

    expect(result.current.missionItems).toHaveLength(1);
    expect(result.current.missionItems[0].title).toBe('Soccer Practice');
    expect(result.current.missionItems[0].type).toBe('event');
  });

  it('filters out completed list items', () => {
    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [],
      events: [],
      listItems: mockListItems,
      kids: mockKids
    }));

    expect(result.current.missionItems).toHaveLength(1);
    expect(result.current.missionItems[0].title).toBe('Milk');
  });

  it('sorts items by time', () => {
    const morningEvent: CalendarEvent = {
        id: 'e1',
        parentId: 'p1',
        title: 'Morning',
        description: '',
        startTime: new Date(`${todayStr}T08:00:00`).getTime(),
        endTime: new Date(`${todayStr}T09:00:00`).getTime(),
        color: ''
    };
    const afternoonEvent: CalendarEvent = {
        id: 'e2',
        parentId: 'p1',
        title: 'Afternoon',
        description: '',
        startTime: new Date(`${todayStr}T14:00:00`).getTime(),
        endTime: new Date(`${todayStr}T15:00:00`).getTime(),
        color: ''
    };

    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [],
      events: [afternoonEvent, morningEvent],
      listItems: [],
      kids: mockKids
    }));

    expect(result.current.missionItems[0].title).toBe('Morning');
    expect(result.current.missionItems[1].title).toBe('Afternoon');
  });
});
