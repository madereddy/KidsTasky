// src/components/shared/BottomNav.tsx
import React from 'react';
import { Calendar, ListTodo, User, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: 'home' | 'calendar' | 'tasks' | string;
  onTabSelect: (tab: string) => void;
  kids?: { uid: string; name: string }[];
}

export function BottomNav({ activeTab, onTabSelect, kids = [] }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-ui safe-area-pb z-[52]">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        <button 
          onClick={() => onTabSelect('home')}
          className={cn("flex flex-col items-center justify-center space-y-1 w-full min-h-[44px] transition-colors", activeTab === 'home' ? "text-sky-600" : "text-ui-muted")}
        >
          <Home size={22} />
          <span className="text-[10px] font-bold">Home</span>
        </button>

        <button 
          onClick={() => onTabSelect('calendar')}
          className={cn("flex flex-col items-center justify-center space-y-1 w-full min-h-[44px] transition-colors", activeTab === 'calendar' ? "text-sky-600" : "text-ui-muted")}
        >
          <Calendar size={22} />
          <span className="text-[10px] font-bold">Calendar</span>
        </button>
        
        {kids.slice(0, 2).map(kid => (
          <button 
            key={kid.uid}
            onClick={() => onTabSelect(`kid_${kid.uid}`)}
            className={cn("flex flex-col items-center justify-center space-y-1 w-full min-h-[44px] transition-colors", activeTab === `kid_${kid.uid}` ? "text-sky-600" : "text-ui-muted")}
          >
            <User size={22} />
            <span className="text-[10px] font-bold truncate max-w-[60px]">{kid.name}</span>
          </button>
        ))}

        <button 
          onClick={() => onTabSelect('manage')}
          className={cn("flex flex-col items-center justify-center space-y-1 w-full min-h-[44px] transition-colors", activeTab === 'manage' ? "text-sky-600" : "text-ui-muted")}
        >
          <User size={22} />
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </div>
    </div>
  );
}
