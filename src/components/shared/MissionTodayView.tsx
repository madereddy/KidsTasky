// src/components/shared/MissionTodayView.tsx
import React from 'react';
import { useMissionTodayController } from '../../hooks/useMissionTodayController';
import { SwipeableRow } from './SwipeableRow';
import { MissionItem, UserProfile, Task, CalendarEvent, AppListItem, Category } from '../../types';
import { Calendar, CheckCircle2, ShoppingCart } from 'lucide-react';

interface MissionTodayViewProps {
  profile: UserProfile;
  tasks: Task[];
  events: CalendarEvent[];
  listItems: AppListItem[];
  kids: UserProfile[];
  categories: Category[];
  onAction: (item: MissionItem, action: 'complete' | 'dismiss') => void;
}

export function MissionTodayView({ profile, tasks, events, listItems, kids, categories, onAction }: MissionTodayViewProps) {
  const { missionItems } = useMissionTodayController({ profile, tasks, events, listItems, kids, categories });

  return (
    <div className="flex flex-col gap-3 pb-24">
      <h2 className="text-2xl font-black px-2 mb-2">MISSION: TODAY</h2>
      {missionItems.map(item => (
        <SwipeableRow 
          key={item.id} 
          onSwipeRight={() => onAction(item, 'complete')}
          onSwipeLeft={() => onAction(item, 'dismiss')}
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-ui-soft">
              {item.type === 'event' && <Calendar className="text-blue-500" />}
              {item.type === 'task' && <CheckCircle2 className="text-emerald-500" />}
              {item.type === 'list_item' && <ShoppingCart className="text-amber-500" />}
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg">{item.title}</div>
              {item.time && <div className="text-sm text-ui-muted">{item.time}</div>}
              {item.subtitle && <div className="text-xs font-bold text-sky-500 uppercase">{item.subtitle}</div>}
            </div>
          </div>
        </SwipeableRow>
      ))}
    </div>
  );
}
