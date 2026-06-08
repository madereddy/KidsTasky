// src/components/shared/BottomNav.tsx
import React from 'react';
import { Calendar, Home, ShoppingCart, Sparkles, User, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabSelect: (tab: string) => void;
  role: 'parent' | 'kid' | 'coparent';
}

export function BottomNav({ activeTab, onTabSelect, role }: BottomNavProps) {
  const isParental = role === 'parent' || role === 'coparent';
  const tabs = isParental
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
    <nav
      aria-label="Primary mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-[52] border-t border-ui bg-ui-soft/95 backdrop-blur-md safe-area-pb"
    >
      <div className="mx-auto flex h-[4.25rem] max-w-md items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'tools' && ['tasks', 'routines', 'meals'].includes(activeTab));
          return (
            <button
              key={tab.id}
              onClick={() => onTabSelect(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={cn(
                "flex min-h-[46px] w-full flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-ui-primary" : "text-ui-muted",
              )}
            >
              <Icon size={22} />
              <span className="text-[11px] font-bold leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
