import React, { useState, useMemo, useCallback } from 'react';
import { useMissionTodayController } from '../../hooks/useMissionTodayController';
import { useHouseholdListPreferences } from '../../hooks/useHouseholdListPreferences';
import { SwipeableRow } from './SwipeableRow';
import { LocationFilterBar } from './LocationFilterBar';
import { FrequentItemChips } from './FrequentItemChips';
import { ProgressRing } from './ProgressRing';
import { MissionItem, UserProfile, Task, CalendarEvent, AppListItem, Category, TaskCompletion, AppList } from '../../types';
import { Calendar, CheckCircle2, ShoppingCart, ListChecks, MapPin, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { listsClientService } from '../../services/lists';
import { clientLogger } from '../../services/clientLogger';
import { cn } from '../../lib/utils';

interface MissionTodayViewProps {
  profile: UserProfile;
  tasks: Task[];
  events: CalendarEvent[];
  completions: TaskCompletion[];
  listItems: AppListItem[];
  lists: AppList[];
  frequentItems?: string[];
  kids: UserProfile[];
  categories: Category[];
  onAction: (item: MissionItem, action: 'complete' | 'dismiss') => void;
  onRefresh?: () => void;
}

export function MissionTodayView({ 
  profile, 
  tasks, 
  events, 
  completions, 
  listItems, 
  lists, 
  frequentItems = [],
  kids, 
  categories, 
  onAction,
  onRefresh
}: MissionTodayViewProps) {
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
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

  const handleQuickAdd = useCallback(async (text: string) => {
    let shoppingList = lists.find(l => l.category === 'shopping');
    if (!shoppingList && lists.length > 0) shoppingList = lists[0];
    
    if (!shoppingList) {
      try {
        shoppingList = await listsClientService.createList('Shopping List', 'shopping');
      } catch (err) {
        clientLogger.error('Failed to create shopping list', { error: err instanceof Error ? err.message : String(err) });
        return;
      }
    }

    if (!shoppingList) return;

    try {
      await listsClientService.addItem(shoppingList.id, text);
      if (onRefresh) onRefresh();
    } catch (err) {
      clientLogger.error('Failed to add item', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [lists, onRefresh]);

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

  const handleCompleteAll = (routineId: string) => {
    const routineItems = listItems.filter(i => i.listId === routineId && !i.completed);
    routineItems.forEach(item => {
      onAction({
        id: `list_${item.id}`,
        type: 'list_item',
        title: item.text,
        status: 'pending',
        originalData: item
      }, 'complete');
    });
    setExpandedRoutineId(null);
  };

  return (
    <div className="flex flex-col gap-3 pb-32">
      <h2 className="text-2xl font-black px-2 mb-2">MISSION: TODAY</h2>
      
      <FrequentItemChips items={frequentItems} onAdd={handleQuickAdd} />
      
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
        const isExpanded = expandedRoutineId === item.id;

        return (
          <SwipeableRow 
            key={item.id} 
            onSwipeRight={() => onAction(item, 'complete')}
            onSwipeLeft={() => onAction(item, 'dismiss')}
            onClick={item.type === 'routine' ? () => setExpandedRoutineId(isExpanded ? null : item.id) : undefined}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-ui-soft shrink-0">
                  {item.type === 'event' && <Calendar className={iconColorClass} style={iconStyle} />}
                  {item.type === 'task' && <CheckCircle2 className={iconColorClass} style={iconStyle} />}
                  {item.type === 'list_item' && (
                    item.listCategory === 'routine'
                      ? <ListChecks className="text-purple-500" />
                      : <ShoppingCart className={iconColorClass} style={iconStyle} />
                  )}
                  {item.type === 'routine' && (
                    <div className="relative">
                      {(() => {
                        const routine = item.originalData as AppList;
                        const total = listItems.filter(i => i.listId === routine.id).length;
                        const completed = listItems.filter(i => i.listId === routine.id && i.completed).length;
                        const percentage = total > 0 ? (completed / total) * 100 : 0;
                        return (
                          <>
                            <ProgressRing 
                              progress={percentage} 
                              size={32} 
                              strokeWidth={3} 
                              color="#a855f7" 
                              className="absolute -top-1 -left-1"
                            />
                            <ListChecks className="text-purple-500 relative z-10" size={20} />
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg truncate">{item.title}</div>
                  <div className="flex items-center gap-2 flex-wrap">
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
                {item.type === 'routine' && (
                  <div className="text-ui-muted">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                )}
              </div>

              {item.type === 'routine' && isExpanded && (
                <div className="mt-2 pl-12 flex flex-col gap-2 border-l-2 border-ui-soft ml-4">
                  {listItems
                    .filter(i => i.listId === (item.originalData as AppList).id && !i.completed)
                    .map(subItem => (
                      <div 
                        key={subItem.id} 
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-ui-soft transition-colors cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction({
                            id: `list_${subItem.id}`,
                            type: 'list_item',
                            title: subItem.text,
                            status: 'pending',
                            originalData: subItem
                          }, 'complete');
                        }}
                      >
                        <span className="font-medium text-ui">{subItem.text}</span>
                        <div className="w-6 h-6 rounded-full border-2 border-ui-soft flex items-center justify-center group-hover:border-emerald-500 transition-colors">
                          <Check size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))
                  }
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompleteAll((item.originalData as AppList).id);
                    }}
                    className="mt-2 py-2 px-4 bg-purple-500 text-white font-bold rounded-lg text-sm hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    COMPLETE ALL
                  </button>
                </div>
              )}
            </div>
          </SwipeableRow>
        );
      })}
    </div>
  );
}
