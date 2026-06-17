import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckSquare, ListPlus } from 'lucide-react';
import { format } from 'date-fns';
import { eventsClientService } from '../../services/events';
import { tasksClientService } from '../../services/tasks';
import { listsClientService } from '../../services/lists';
import { UserProfile, AppList } from '../../types';
import { cn } from '../../lib/utils';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { clientLogger } from '../../services/clientLogger';

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];

interface Props {
  onClose: () => void;
  onSubmit: () => void;
  kids: UserProfile[];
  parentId: string;
  routineLists?: AppList[];
  defaultDate?: Date;
  defaultStartTime?: string;
  userRole?: 'parent' | 'kid' | 'coparent';
}

type TabType = 'event' | 'task' | 'list';

export function QuickAddModal({ onClose, onSubmit, kids, parentId, routineLists = [], defaultDate, defaultStartTime }: Props) {
  const { dialogRef, onKeyDown } = useDialogA11y(true, onClose);
  const [activeTab, setActiveTab] = useState<TabType>('event');
  const [saving, setSaving] = useState(false);

  // Event Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [eventStartTime, setEventStartTime] = useState(defaultStartTime || '09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [eventColor, setEventColor] = useState(PRESET_COLORS[0]);
  const [eventAssignedToId, setEventAssignedToId] = useState('');
  const [eventRoutineListId, setEventRoutineListId] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);

  // Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignedKidId, setTaskAssignedKidId] = useState('');
  const [taskStarValue, setTaskStarValue] = useState(1);

  // List Item Form State
  const [listId, setListId] = useState('');
  const [listItemText, setListItemText] = useState('');
  const [lists, setLists] = useState<AppList[]>([]);

  useEffect(() => {
    if (activeTab === 'list' && lists.length === 0) {
      listsClientService.getLists(parentId).then(setLists).catch((error) => {
        clientLogger.errorWithException('quick_add_lists_load_failed', error, { parentId });
      });
    }
  }, [activeTab, parentId, lists.length]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setSaving(true);
    try {
      const startMs = isAllDay ? new Date(eventDate + 'T00:00:00').getTime() : new Date(`${eventDate}T${eventStartTime}`).getTime();
      const endMs = isAllDay ? new Date(eventDate + 'T23:59:59.999').getTime() : new Date(`${eventDate}T${eventEndTime}`).getTime();
      
      await eventsClientService.createEvent({
        parentId,
        title: eventTitle.trim(),
        description: '',
        startTime: startMs,
        endTime: endMs > startMs ? endMs : startMs + 3600000,
        color: eventColor,
        assignedToId: eventAssignedToId || undefined,
        routineListId: eventRoutineListId || undefined,
        isAllDay: isAllDay ? 1 : 0,
        recurrence: 'none',
      });
      onSubmit();
      onClose();
    } catch (error) {
      clientLogger.errorWithException('quick_add_event_failed', error, { parentId, eventTitle });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskAssignedKidId) return;
    setSaving(true);
    try {
      await tasksClientService.createTask({
        parentId,
        title: taskTitle.trim(),
        assignedKidId: taskAssignedKidId,
        starValue: taskStarValue,
        frequency: 'daily',
        requiresApproval: true
      });
      onSubmit();
      onClose();
    } catch (error) {
      clientLogger.errorWithException('quick_add_task_failed', error, { parentId, taskTitle });
    } finally {
      setSaving(false);
    }
  };

  const handleAddListItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listItemText.trim() || !listId) return;
    setSaving(true);
    try {
      await listsClientService.addItem(listId, listItemText.trim());
      onSubmit();
      onClose();
    } catch (error) {
      clientLogger.errorWithException('quick_add_list_item_failed', error, { parentId, listId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ui-deep-80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" tabIndex={-1} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b shrink-0 bg-ui-soft">
          <h2 id="quick-add-title" className="text-xl font-bold text-ui-primary">Quick Add</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-ui-soft-3 rounded-full transition-colors text-ui-muted">
            <X size={24} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b shrink-0 bg-white">
          <button
            onClick={() => setActiveTab('event')}
            className={cn(
              "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all",
              activeTab === 'event' ? "border-blue-500 text-blue-600 bg-blue-50/50" : "border-transparent text-ui-muted hover:text-ui-secondary hover:bg-ui-soft"
            )}
          >
            <Calendar size={18} />
            Event
          </button>
          <button
            onClick={() => setActiveTab('task')}
            className={cn(
              "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all",
              activeTab === 'task' ? "border-emerald-500 text-emerald-600 bg-emerald-50/50" : "border-transparent text-ui-muted hover:text-ui-secondary hover:bg-ui-soft"
            )}
          >
            <CheckSquare size={18} />
            Task
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all",
              activeTab === 'list' ? "border-amber-500 text-amber-600 bg-amber-50/50" : "border-transparent text-ui-muted hover:text-ui-secondary hover:bg-ui-soft"
            )}
          >
            <ListPlus size={18} />
            List
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === 'event' && (
            <form onSubmit={handleAddEvent} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Event Title *</label>
                <input
                  required
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-ui-soft/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-ui-soft/30"
                  />
                </div>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={isAllDay} 
                      onChange={e => setIsAllDay(e.target.checked)} 
                      className="w-4 h-4 rounded border-ui text-blue-500 focus:ring-blue-400" 
                    />
                    <span className="text-sm font-semibold text-ui-secondary group-hover:text-ui-primary transition-colors">All day</span>
                  </label>
                </div>
              </div>

              {!isAllDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Start Time</label>
                    <input type="time" value={eventStartTime} onChange={e => setEventStartTime(e.target.value)}
                      className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-ui-soft/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">End Time</label>
                    <input type="time" value={eventEndTime} onChange={e => setEventEndTime(e.target.value)}
                      className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-ui-soft/30" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Color</label>
                <div className="flex gap-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEventColor(c)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all shadow-sm",
                        eventColor === c ? "border-ui-dark-2 scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Assign To</label>
                <select
                  value={eventAssignedToId}
                  onChange={e => setEventAssignedToId(e.target.value)}
                  className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-ui-soft/30"
                >
                  <option value="">Everyone</option>
                  {kids.map(k => <option key={k.uid} value={k.uid}>{k.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Attached Routine</label>
                <select
                  value={eventRoutineListId}
                  onChange={e => setEventRoutineListId(e.target.value)}
                  className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-ui-soft/30"
                >
                  <option value="">None</option>
                  {routineLists.map((routine) => <option key={routine.id} value={routine.id}>{routine.title}</option>)}
                </select>
              </div>

              <button type="submit" disabled={saving || !eventTitle.trim()}
                className="w-full py-4 bg-blue-500 text-white rounded-2xl text-base font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 mt-2">
                {saving ? 'Creating Event...' : 'Add Event'}
              </button>
            </form>
          )}

          {activeTab === 'task' && (
            <form onSubmit={handleAddTask} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Task Title *</label>
                <input
                  required
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="e.g., Brush Teeth, Feed the dog"
                  className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-ui-soft/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Assign To *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTaskAssignedKidId('all')}
                    className={cn(
                      "px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all text-center",
                      taskAssignedKidId === 'all'
                        ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-sm"
                        : "border-ui bg-ui-soft/30 text-ui-muted hover:border-ui-soft-strong hover:text-ui-secondary"
                    )}
                  >
                    Up for Grabs
                  </button>
                  {kids.map(k => (
                    <button
                      key={k.uid}
                      type="button"
                      onClick={() => setTaskAssignedKidId(k.uid)}
                      className={cn(
                        "px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all text-center",
                        taskAssignedKidId === k.uid 
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm" 
                          : "border-ui bg-ui-soft/30 text-ui-muted hover:border-ui-soft-strong hover:text-ui-secondary"
                      )}
                    >
                      {k.name}
                    </button>
                  ))}
                </div>
                {!taskAssignedKidId && kids.length === 0 && (
                  <p className="text-xs text-rose-500 mt-1">No kids found. Add a kid in settings first.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Star Value</label>
                <div className="flex items-center gap-4">
                  {[1, 2, 3, 5, 10].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTaskStarValue(val)}
                      className={cn(
                        "w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
                        taskStarValue === val
                          ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm scale-110"
                          : "border-ui bg-ui-soft/30 text-ui-muted hover:border-ui-soft-strong"
                      )}
                    >
                      ⭐{val}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={saving || !taskTitle.trim() || !taskAssignedKidId}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-base font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-200 mt-2">
                {saving ? 'Creating Task...' : 'Add Task'}
              </button>
            </form>
          )}

          {activeTab === 'list' && (
            <form onSubmit={handleAddListItem} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Select List *</label>
                <select
                  required
                  value={listId}
                  onChange={e => setListId(e.target.value)}
                  className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-ui-soft/30"
                >
                  <option value="">-- Choose a list --</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
                {lists.length === 0 && (
                   <p className="text-xs text-ui-muted mt-2">No lists found. Create one in Shopping or Routines.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-ui-muted uppercase tracking-wider mb-1.5">Item Text *</label>
                <input
                  required
                  value={listItemText}
                  onChange={e => setListItemText(e.target.value)}
                  placeholder="e.g., Milk, Bread, Do laundry"
                  className="w-full border border-ui rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-ui-soft/30"
                />
              </div>

              <button type="submit" disabled={saving || !listItemText.trim() || !listId}
                className="w-full py-4 bg-amber-500 text-white rounded-2xl text-base font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-200 mt-2">
                {saving ? 'Adding to List...' : 'Add to List'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
