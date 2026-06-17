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
  onRoutineItemToggle?: (item: AppListItem, completed: boolean) => void;
  onRoutineReset?: (list: AppList) => void;
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
  onRoutineItemToggle,
  onRoutineReset,
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
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

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
        const showRoutineChecklist = item.type === 'routine' && (isMobileViewport || isExpanded);
        const disableRoutineDismissSwipe = item.type === 'routine' && isMobileViewport;
        const routineList = item.type === 'routine' ? item.originalData as AppList : null;
        const routineChecklistItems = routineList
          ? listItems.filter((listItem) => listItem.listId === routineList.id)
          : [];
        const remainingRoutineItems = routineChecklistItems.filter((listItem) => !listItem.completed);
        const routineCompleted = item.type === 'routine' && remainingRoutineItems.length === 0;

        return (
          <SwipeableRow 
            key={item.id} 
            onSwipeRight={() => onAction(item, 'complete')}
            onSwipeLeft={disableRoutineDismissSwipe ? undefined : () => onAction(item, 'dismiss')}
            onClick={item.type === 'routine' && !isMobileViewport ? () => setExpandedRoutineId(isExpanded ? null : item.id) : undefined}
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
                  {item.subtitle && (
                    <div className={cn(
                      "mt-0.5 text-xs font-bold uppercase",
                      item.status === 'completed' ? "text-emerald-600" : "text-sky-500",
                    )}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                {item.type === 'routine' && !isMobileViewport && (
                  <div className="text-ui-muted">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                )}
              </div>

              {showRoutineChecklist && (
                <div className={cn(
                  "flex flex-col gap-2",
                  isMobileViewport ? "mt-1" : "mt-2 ml-4 border-l-2 border-ui-soft pl-12",
                )}>
                  {routineChecklistItems.map(subItem => (
                      <button
                        type="button"
                        key={subItem.id} 
                        className={cn(
                          "group flex items-center justify-between rounded-lg transition-colors",
                          isMobileViewport
                            ? "min-h-14 border border-ui bg-white px-4 py-3 text-left hover:bg-ui-soft"
                            : "cursor-pointer p-2 hover:bg-ui-soft",
                          subItem.completed === 1 && "bg-ui-soft/70",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRoutineItemToggle) {
                            onRoutineItemToggle(subItem, subItem.completed !== 1);
                            return;
                          }
                          if (subItem.completed !== 1) {
                            onAction({
                              id: `list_${subItem.id}`,
                              type: 'list_item',
                              title: subItem.text,
                              status: 'pending',
                              originalData: subItem
                            }, 'complete');
                          }
                        }}
                      >
                        <span className={cn(
                          "font-medium text-ui",
                          isMobileViewport && "text-base font-semibold",
                          subItem.completed === 1 && "text-ui-muted line-through",
                        )}>
                          {subItem.text}
                        </span>
                        <div className={cn(
                          "flex items-center justify-center transition-colors",
                          isMobileViewport
                            ? "h-7 w-7 rounded-md border-2 bg-ui-soft"
                            : "h-6 w-6 rounded-full border-2",
                          subItem.completed === 1
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : isMobileViewport
                              ? "border-ui-soft-3"
                              : "border-ui-soft group-hover:border-emerald-500",
                        )}>
                          <Check size={14} className={cn(
                            "transition-opacity",
                            subItem.completed === 1
                              ? "opacity-100 text-white"
                              : isMobileViewport
                                ? "opacity-100 text-emerald-500"
                                : "opacity-0 text-emerald-500 group-hover:opacity-100",
                          )} />
                        </div>
                      </button>
                    ))}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (routineCompleted) {
                        onRoutineReset?.(item.originalData as AppList);
                        return;
                      }
                      handleCompleteAll((item.originalData as AppList).id);
                    }}
                    className={cn(
                      "mt-2 flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2 font-bold text-white transition-colors hover:bg-purple-600",
                      isMobileViewport ? "min-h-12 text-base" : "text-sm",
                      routineCompleted && "bg-emerald-500 hover:bg-emerald-600",
                    )}
                  >
                    <CheckCircle2 size={16} />
                    {routineCompleted ? 'RESET ROUTINE' : 'COMPLETE ALL'}
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
