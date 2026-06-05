import React from 'react';
import { 
  WallSkeleton, 
  KidDashboardSkeleton, 
  ParentTasksWorkspaceSkeleton, 
  CalendarSkeleton,
  ListsSkeleton,
  MealsSkeleton,
  ParentDashboardSkeleton
} from './Skeleton';

interface SectionSkeletonProps {
  role: 'parent' | 'kid' | 'coparent';
  activeSection: string;
}

export function SectionSkeleton({ role, activeSection }: SectionSkeletonProps) {
  if (role === 'kid') return <KidDashboardSkeleton />;
  
  switch (activeSection) {
    case 'home':
      return <WallSkeleton />;
    case 'tasks':
      return <ParentTasksWorkspaceSkeleton />;
    case 'calendar':
      return <CalendarSkeleton />;
    case 'lists':
    case 'shopping':
    case 'routines':
      return <ListsSkeleton />;
    case 'meals':
      return <MealsSkeleton />;
    case 'manage':
      return <ParentDashboardSkeleton />;
    default:
      return <WallSkeleton />;
  }
}
