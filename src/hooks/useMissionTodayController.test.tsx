// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useMissionTodayController } from './useMissionTodayController';
import { UserProfile, Task, CalendarEvent, AppListItem, Category, TaskCompletion } from '../types';

describe('useMissionTodayController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-20T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockProfile: UserProfile = {
    uid: 'kid1',
    role: 'kid',
    name: 'Kid One',
    email: 'kid1@example.com',
  };

  const mockCategories: Category[] = [
    { id: 'cat1', name: 'Home', icon: '🏠', color: 'bg-blue-500', parentId: 'p1' },
    { id: 'cat2', name: 'School', icon: '🏫', color: 'bg-emerald-500', parentId: 'p1' }
  ];

  const getMockTasks = () => [
    {
      id: 'task1',
      title: 'Brush Teeth',
      assignedKidId: 'kid1',
      parentId: 'parent1',
      status: 'active',
      frequency: 'daily',
      categoryId: 'cat1',
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
  ] as Task[];

  const getMockEvents = () => {
    return [
      {
        id: 'event1',
        parentId: 'parent1',
        title: 'Soccer Practice',
        description: 'Practice at the park',
        startTime: new Date('2024-05-20T15:00:00').getTime(),
        endTime: new Date('2024-05-20T16:00:00').getTime(),
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
    ] as CalendarEvent[];
  };

  const mockListItems: AppListItem[] = [
    { id: 'list1', listId: 'l1', text: 'Milk', completed: 0 },
    { id: 'list2', listId: 'l1', text: 'Bread', completed: 1 },
  ];

  const mockKids: UserProfile[] = [mockProfile];

  it('filters and transforms tasks for the active kid', () => {
    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: getMockTasks(),
      events: [],
      completions: [],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    expect(result.current.missionItems).toHaveLength(1);
    expect(result.current.missionItems[0]).toMatchObject({
      id: 'task_task1',
      type: 'task',
      title: 'Brush Teeth',
      status: 'pending',
      color: 'bg-blue-500'
    });
  });

  it('filters out completed daily tasks', () => {
    const completions: TaskCompletion[] = [
      {
        id: 'c1',
        taskId: 'task1',
        kidId: 'kid1',
        dateString: '2024-05-20',
        completedAt: Date.now()
      }
    ];

    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: getMockTasks(),
      events: [],
      completions,
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    expect(result.current.missionItems).toHaveLength(0);
  });

  it('handles twice-daily tasks correctly', () => {
    const task: Task = {
      id: 'task_td',
      title: 'Water Plants',
      assignedKidId: 'kid1',
      parentId: 'parent1',
      status: 'active',
      frequency: 'twice-daily',
      createdAt: Date.now(),
    };

    // Scenario 1: No completions
    const { result: r1 } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [task],
      events: [],
      completions: [],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));
    expect(r1.current.missionItems).toHaveLength(1);

    // Scenario 2: One completion (not enough for twice-daily)
    const { result: r2 } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [task],
      events: [],
      completions: [{ id: 'c1', taskId: 'task_td', kidId: 'kid1', dateString: '2024-05-20', completedAt: Date.now(), count: 1 }],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));
    expect(r2.current.missionItems).toHaveLength(1);

    // Scenario 3: Two completions (fully completed)
    const { result: r3 } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [task],
      events: [],
      completions: [
        { id: 'c1', taskId: 'task_td', kidId: 'kid1', dateString: '2024-05-20', completedAt: Date.now(), count: 1 },
        { id: 'c2', taskId: 'task_td', kidId: 'kid1', dateString: '2024-05-20', completedAt: Date.now(), count: 2 }
      ],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));
    expect(r3.current.missionItems).toHaveLength(0);
  });

  it('filters events to show only today', () => {
    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [],
      events: getMockEvents(),
      completions: [],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    expect(result.current.missionItems).toHaveLength(1);
    expect(result.current.missionItems[0].title).toBe('Soccer Practice');
    expect(result.current.missionItems[0].type).toBe('event');
  });

  it('filters out completed list items and detects store names', () => {
    const listWithStores: AppListItem[] = [
      { id: 'l1', listId: 'list1', text: 'Milk at Costco', completed: 0 },
      { id: 'l2', listId: 'list1', text: 'Walmart Bread', completed: 0 },
      { id: 'l3', listId: 'list1', text: 'Regular Item', completed: 0 },
    ];
    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [],
      events: [],
      completions: [],
      listItems: listWithStores,
      kids: mockKids,
      categories: mockCategories
    }));

    expect(result.current.missionItems).toHaveLength(3);
    expect(result.current.missionItems.find(i => i.id === 'list_l1')?.storeName).toBe('Costco');
    expect(result.current.missionItems.find(i => i.id === 'list_l2')?.storeName).toBe('Walmart');
    expect(result.current.missionItems.find(i => i.id === 'list_l3')?.storeName).toBeUndefined();
  });

  it('populates time for tasks with reminderTime', () => {
    const taskWithTime: Task = {
        ...getMockTasks()[0],
        reminderTime: '09:30'
    };
    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [taskWithTime],
      events: [],
      completions: [],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    expect(result.current.missionItems[0].time).toBe('09:30');
  });

  it('sorts items with time first, then items without time', () => {
    const morningEvent: CalendarEvent = {
        id: 'e1',
        parentId: 'p1',
        title: 'Morning Event',
        description: '',
        startTime: new Date('2024-05-20T08:00:00').getTime(),
        endTime: new Date('2024-05-20T09:00:00').getTime(),
        color: ''
    };
    const taskNoTime: Task = {
        id: 't1',
        title: 'Task No Time',
        assignedKidId: 'kid1',
        parentId: 'p1',
        status: 'active',
        frequency: 'daily',
        createdAt: Date.now()
    };
    const taskWithTime: Task = {
        id: 't2',
        title: 'Task With Time',
        reminderTime: '10:00',
        assignedKidId: 'kid1',
        parentId: 'p1',
        status: 'active',
        frequency: 'daily',
        createdAt: Date.now()
    };

    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [taskNoTime, taskWithTime],
      events: [morningEvent],
      completions: [],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    // Expected order: 08:00 (Event), 10:00 (Task), No Time (Task)
    expect(result.current.missionItems).toHaveLength(3);
    expect(result.current.missionItems[0].title).toBe('Morning Event');
    expect(result.current.missionItems[1].title).toBe('Task With Time');
    expect(result.current.missionItems[2].title).toBe('Task No Time');
  });

  it('shows tasks awaiting approval with needs_approval status', () => {
    const task: Task = {
      id: 'task_app',
      title: 'Approval Task',
      assignedKidId: 'kid1',
      parentId: 'p1',
      status: 'active',
      frequency: 'daily',
      requiresApproval: true,
      createdAt: Date.now()
    };

    const completions: TaskCompletion[] = [{
      id: 'c1',
      taskId: 'task_app',
      kidId: 'kid1',
      dateString: '2024-05-20',
      completedAt: Date.now(),
      approvalStatus: 'pending'
    }];

    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [task],
      events: [],
      completions,
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    expect(result.current.missionItems).toHaveLength(1);
    expect(result.current.missionItems[0].status).toBe('needs_approval');
  });

  it('does not count rejected completions towards completion count', () => {
    const task: Task = {
      id: 'task1',
      title: 'Brush Teeth',
      assignedKidId: 'kid1',
      parentId: 'p1',
      status: 'active',
      frequency: 'daily',
      createdAt: Date.now()
    };

    const completions: TaskCompletion[] = [{
      id: 'c1',
      taskId: 'task1',
      kidId: 'kid1',
      dateString: '2024-05-20',
      completedAt: Date.now(),
      approvalStatus: 'rejected'
    }];

    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [task],
      events: [],
      completions,
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    // Task should still be visible because the completion was rejected
    expect(result.current.missionItems).toHaveLength(1);
    expect(result.current.missionItems[0].status).toBe('pending');
  });

  it('deduplicates mission items by id', () => {
    const task: Task = {
      id: 'task1',
      title: 'Brush Teeth',
      assignedKidId: 'kid1',
      parentId: 'p1',
      status: 'active',
      frequency: 'daily',
      createdAt: Date.now()
    };

    const { result } = renderHook(() => useMissionTodayController({
      profile: mockProfile,
      tasks: [task, task], // Duplicate task
      events: [],
      completions: [],
      listItems: [],
      kids: mockKids,
      categories: mockCategories
    }));

    expect(result.current.missionItems).toHaveLength(1);
  });
});
