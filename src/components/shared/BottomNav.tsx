// src/components/shared/BottomNav.tsx
import React from 'react';
import { Calendar, Home, ShoppingCart, Sparkles, User, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabSelect: (tab: string) => void;
  role: 'parent' | 'kid';
}

export function BottomNav({ activeTab, onTabSelect, role }: BottomNavProps) {
  const tabs = role === 'parent'
    ? [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'calendar', label: 'Cal', icon: Calendar },
        { id: 'shopping', label: 'Shop', icon: ShoppingCart },
        { id: 'tools', label: 'Tools', icon: Wrench },
        { id: 'switch', label: 'Switch', icon: User },
      ]
    : [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'calendar', label: 'Cal', icon: Calendar },
        { id: 'tasks', label: 'Tasks', icon: Sparkles },
        { id: 'manage', label: 'Shop', icon: ShoppingCart },
        { id: 'switch', label: 'Switch', icon: User },
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-ui safe-area-pb z-[52]">
      <div className="flex h-16 items-center justify-around max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'tools' && ['tasks', 'routines', 'meals'].includes(activeTab));
          return (
            <button
              key={tab.id}
              onClick={() => onTabSelect(tab.id)}
              className={cn(
                "flex min-h-[44px] w-full flex-col items-center justify-center space-y-1 transition-colors",
                isActive ? "text-sky-600" : "text-ui-muted",
              )}
            >
              <Icon size={22} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
