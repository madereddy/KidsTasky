import React, { useState, useMemo } from 'react';
import { useMissionTodayController } from '../../hooks/useMissionTodayController';
import { useHouseholdListPreferences } from '../../hooks/useHouseholdListPreferences';
import { SwipeableRow } from './SwipeableRow';
import { LocationFilterBar } from './LocationFilterBar';
import { MissionItem, UserProfile, Task, CalendarEvent, AppListItem, Category, TaskCompletion, AppList } from '../../types';
import { Calendar, CheckCircle2, ShoppingCart, ListChecks, MapPin } from 'lucide-react';

interface MissionTodayViewProps {
  profile: UserProfile;
  tasks: Task[];
  events: CalendarEvent[];
  completions: TaskCompletion[];
  listItems: AppListItem[];
  lists: AppList[];
  kids: UserProfile[];
  categories: Category[];
  onAction: (item: MissionItem, action: 'complete' | 'dismiss') => void;
}

export function MissionTodayView({ profile, tasks, events, completions, listItems, lists, kids, categories, onAction }: MissionTodayViewProps) {
  const familyParentId = profile.parentId || profile.uid;
  const { storeNames, locationOptions } = useHouseholdListPreferences(familyParentId);

  const { missionItems } = useMissionTodayController({ 
    profile, 
    tasks, 
    events, 
    completions, 
    listItems, 
    lists, 
    kids, 
    categories,
    storeNames,
    locationOptions
  });
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!activeLocation) return missionItems;
    
    return missionItems.filter(item => {
      // Direct location match
      if (item.locationName === activeLocation) return true;
      
      // Grocery items match "Stores" filter
      if (activeLocation === 'Stores' && item.storeName) return true;
      
      return false;
    });
  }, [missionItems, activeLocation]);

  return (
    <div className="flex flex-col gap-3 pb-32">
      <h2 className="text-2xl font-black px-2 mb-2">MISSION: TODAY</h2>
      
      <div className="fixed bottom-[4.25rem] left-0 right-0 z-[45] bg-gradient-to-t from-ui-soft via-ui-soft/95 to-transparent pt-6 pb-2 px-2">
        <LocationFilterBar 
          activeLocation={activeLocation} 
          onLocationSelect={setActiveLocation} 
          locationOptions={locationOptions}
        />
      </div>

      {filteredItems.map(item => {
        const isHex = item.color?.startsWith('#');
        const iconColorClass = item.color && !isHex 
          ? (item.color.startsWith('bg-') ? item.color.replace('bg-', 'text-') : item.color)
          : (item.type === 'event' ? 'text-blue-500' : item.type === 'task' ? 'text-emerald-500' : 'text-amber-500');
        const iconStyle = isHex ? { color: item.color } : {};

        return (
          <SwipeableRow 
            key={item.id} 
            onSwipeRight={() => onAction(item, 'complete')}
            onSwipeLeft={() => onAction(item, 'dismiss')}
          >
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-ui-soft">
                {item.type === 'event' && <Calendar className={iconColorClass} style={iconStyle} />}
                {item.type === 'task' && <CheckCircle2 className={iconColorClass} style={iconStyle} />}
                {item.type === 'list_item' && (
                  item.listCategory === 'routine'
                    ? <ListChecks className="text-purple-500" />
                    : <ShoppingCart className={iconColorClass} style={iconStyle} />
                )}
                {item.type === 'routine' && <ListChecks className="text-purple-500" />}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg">{item.title}</div>
                <div className="flex items-center gap-2">
                  {item.time && <div className="text-sm text-ui-muted">{item.time}</div>}
                  {item.locationName && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      <MapPin size={10} />
                      {item.locationName}
                    </div>
                  )}
                  {item.storeName && !item.locationName && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-amber-100">
                      🛒 {item.storeName}
                    </div>
                  )}
                </div>
                {item.subtitle && <div className="text-xs font-bold text-sky-500 uppercase mt-0.5">{item.subtitle}</div>}
              </div>
            </div>
          </SwipeableRow>
        );
      })}
    </div>
  );
}
