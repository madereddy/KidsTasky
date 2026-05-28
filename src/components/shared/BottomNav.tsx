// src/components/shared/BottomNav.tsx
import React from 'react';
import { Calendar, ListTodo, User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: 'calendar' | 'tasks' | string;
  onTabSelect: (tab: string) => void;
  kids?: { id: string; name: string }[];
}

export function BottomNav({ activeTab, onTabSelect, kids = [] }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-ui safe-area-pb z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
        <button 
          onClick={() => onTabSelect('calendar')}
          className={cn("flex flex-col items-center justify-center space-y-1 w-full min-h-[44px]", activeTab === 'calendar' ? "text-blue-600" : "text-ui-muted")}
        >
          <Calendar size={24} />
          <span className="text-xs font-medium">Calendar</span>
        </button>
        
        {kids.map(kid => (
          <button 
            key={kid.id}
            onClick={() => onTabSelect(`kid_${kid.id}`)}
            className={cn("flex flex-col items-center justify-center space-y-1 w-full min-h-[44px]", activeTab === `kid_${kid.id}` ? "text-blue-600" : "text-ui-muted")}
          >
            <User size={24} />
            <span className="text-xs font-medium">{kid.name}</span>
          </button>
        ))}

        <button 
          onClick={() => onTabSelect('tasks')}
          className={cn("flex flex-col items-center justify-center space-y-1 w-full min-h-[44px]", activeTab === 'tasks' ? "text-blue-600" : "text-ui-muted")}
        >
          <ListTodo size={24} />
          <span className="text-xs font-medium">Tasks</span>
        </button>
      </div>
    </div>
  );
}
