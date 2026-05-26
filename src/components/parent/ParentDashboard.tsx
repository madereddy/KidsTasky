import { fetchAPI } from '../../services/http';
import { userService } from '../../services/users';
import { tasksClientService } from '../../services/tasks';
import { inviteService } from '../../services/invites';
import { notificationService } from '../../services/notifications';
import { rewardService } from '../../services/rewards';
import { syncClientService } from '../../services/sync';
import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Calendar, Clock, CalendarDays, Tag, Plus, ShieldCheck, Bell, Send, CheckCircle2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Task, UserProfile, Category, Invite, Notification, Reward, TaskFrequency, TaskDifficulty, SyncCalendar } from '../../types';
import { MEMBER_COLORS } from '../../constants';
import { AddTaskModal } from './AddTaskModal';
import { AddKidForm } from './AddKidForm';
import { CategoryManager } from './CategoryManager';
import { RewardManager } from './RewardManager';
import { AllowanceLedger } from './AllowanceLedger';
import { ConnectedAccountsView } from './ConnectedAccountsView';
import { parseTimestamp } from '../../lib/utils';
import { useSocketStaleData } from '../../hooks/useSocket';

export function ParentDashboard({ 
  profile, 
  categories, 
  onCategoriesChange,
  selectedCategoryId,
  isLocked = false,
  onLockNow
}: { 
  profile: UserProfile, 
  categories: Category[],
  onCategoriesChange: (cats: Category[]) => void,
  selectedCategoryId: string | null,
  isLocked?: boolean,
  onLockNow?: () => void
}) {
  const isDarkMode = !!profile.themeId && profile.themeId !== 'light_blue' && profile.themeId !== 'light_green' && profile.themeId !== 'light_rose';
  const toneSecondary = isDarkMode ? "text-ui-muted-2" : "text-ui-muted";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingCompletions, setPendingCompletions] = useState<any[]>([]);
  const [kids, setKids] = useState<UserProfile[]>([]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [syncCalendars, setSyncCalendars] = useState<SyncCalendar[]>([]);
  const [sortBy, setSortBy] = useState<'time' | 'created'>('created');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [savingColor, setSavingColor] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const familyId = profile.role === 'coparent' && profile.parentId ? profile.parentId : profile.uid;
      const [t, pc, k, i, n, r, c, sc] = await Promise.all([
        tasksClientService.getTasksForParent(profile.uid),
        tasksClientService.getPendingCompletions(familyId),
        userService.getKidsForParent(profile.uid),
        inviteService.getActiveInvite(profile.uid),
        notificationService.getUnreadNotifications(profile.uid),
        rewardService.getRewards(profile.uid),
        fetchAPI('/settings/' + profile.uid + '/connections').catch(() => []),
        syncClientService.getCalendars(profile.uid).catch(() => [])
      ]);
      setTasks(t || []);
      setPendingCompletions(pc || []);
      setKids(k || []);
      setInvite(i || null);
      setNotifications(n || []);
      setRewards(r || []);
      setConnections(c || []);
      setSyncCalendars(sc || []);
    } catch (e) {
      console.error("Failed to fetch dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, [profile.uid, profile.role, profile.parentId]);

  useSocketStaleData((data) => {
    // Only fetch if data was mutated somewhere else
    fetchData();
  });

  useEffect(() => {
    fetchData();

    // Poll for notifications every minute
    const interval = setInterval(async () => {
      const n = await notificationService.getUnreadNotifications(profile.uid);
      setNotifications(n || []);
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchData, profile.uid]);

  const markRead = async (id: string) => {
    await notificationService.markNotificationRead(id);
    setNotifications(notifications.filter((n: Notification) => n.id !== id));
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    await inviteService.createInvite(profile.uid, profile.name);
    const updatedInvite = await inviteService.getActiveInvite(profile.uid);
    setInvite(updatedInvite);
    setGeneratingInvite(false);
  };

  const handleCopy = () => {
    if (invite) {
      navigator.clipboard.writeText(invite.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    await tasksClientService.createTask(task);
    const updated = await tasksClientService.getTasksForParent(profile.uid);
    setTasks(updated);
    setIsAddingTask(false);
  };

  const refreshRewards = async () => {
    const r = await rewardService.getRewards(profile.uid);
    setRewards(r || []);
  };

  const approveCompletion = async (id: string) => {
    await tasksClientService.approveCompletion(id);
    setPendingCompletions(prev => prev.filter(c => c.id !== id));
  };

  const rejectCompletion = async (id: string) => {
    await tasksClientService.rejectCompletion(id);
    setPendingCompletions(prev => prev.filter(c => c.id !== id));
  };

  const archiveTask = async (id: string) => {
    await tasksClientService.archiveTask(id);
    setTasks(tasks.filter((t: Task) => t.id !== id));
  };

  const handleDisconnect = async (connId: string) => {
    try {
      await fetchAPI('/settings/connections/' + connId, { method: 'DELETE' });
      setConnections(connections.filter(c => c.id !== connId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleCalendar = async (calendarId: string, enabled: boolean) => {
    const previous = syncCalendars;
    setSyncCalendars((calendars) =>
      calendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, enabled } : calendar
      )
    );
    try {
      await syncClientService.toggleCalendar(calendarId, enabled);
    } catch (e) {
      console.error(e);
      setSyncCalendars(previous);
      alert('Failed to update calendar sync setting');
    }
  };

  if (loading) return null;

  const filteredTasks = (selectedCategoryId 
    ? tasks.filter((t: Task) => t.categoryId === selectedCategoryId)
    : [...tasks]).sort((a: Task, b: Task) => {
      if (sortBy === 'time') {
        const timeA = a.reminderTime || '99:99';
        const timeB = b.reminderTime || '99:99';
        return timeA.localeCompare(timeB);
      }
      return parseTimestamp(b.createdAt).getTime() - parseTimestamp(a.createdAt).getTime();
    });

  return (
    <div className="space-y-8">
      <RewardManager parentId={profile.uid} rewards={rewards} onUpdate={refreshRewards} />
      <AllowanceLedger parentId={profile.uid} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white shadow-sm border border-ui-soft p-6 rounded-3xl border-l-4 border-l-blue-500 flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-2">Ground Control Command</h3>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white shadow-sm border border-ui rounded-2xl relative">
                <ShieldCheck className="w-6 h-6 text-blue-500" />
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-ui-soft-2 rounded-full flex items-center justify-center border border-ui hover:border-amber-500 transition-colors"
                >
                  <Bell className={cn("w-3 h-3", notifications.length > 0 ? "text-amber-500 animate-pulse" : "text-ui-muted")} />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white" />
                  )}
                </button>
              </div>
              <div>
                <p className="text-[10px] text-ui-muted font-black uppercase tracking-widest leading-none mb-1">Sector Commander</p>
                <p className="font-bold text-ui-primary leading-none">{profile.name}</p>
              </div>
            </div>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-4 w-64 bg-white border border-ui rounded-2xl shadow-2xl z-[100] max-h-[300px] overflow-y-auto"
                >
                  <div className="p-3 border-b border-ui flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-10">
                    <span className="text-[8px] font-black uppercase tracking-widest text-ui-muted">Tactical Alerts</span>
                    <span className="text-[8px] font-bold text-amber-500">{notifications.length} NEW</span>
                  </div>
                  <div className="p-1 space-y-1">
                    {notifications.length === 0 ? (
                       <div className="p-4 text-center">
                         <p className="text-[8px] text-ui-muted uppercase font-bold">No breaches detected</p>
                       </div>
                    ) : (
                      notifications.map((n: Notification) => (
                        <div key={n.id} className="p-3 bg-white hover:bg-ui-soft rounded-xl border border-ui-soft flex flex-col gap-2 group">
                          <div>
                            <p className="text-[7px] font-black text-amber-600 uppercase mb-0.5">Overdue Objective</p>
                            <p className="text-ui-primary font-bold text-[9px] leading-tight truncate">{n.taskTitle}</p>
                            <p className="text-ui-muted text-[8px] uppercase font-bold tracking-tight">Cadet: {n.kidName}</p>
                          </div>
                          <button 
                            onClick={() => markRead(n.id)}
                            className="text-[8px] font-bold text-sky-500 hover:text-sky-600 uppercase tracking-widest text-left"
                          >
                            Mark Handled
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative z-10 flex flex-col items-end">
            {!invite ? (
              <button 
                onClick={generateInvite}
                disabled={generatingInvite}
                className="bg-sky-500 hover:bg-sky-600 text-white shadow-md border-b-4 border-sky-600 active:border-b-0 active:mt-1 rounded-2xl transition-all px-6 py-3 font-bold text-xs uppercase tracking-wider"
              >
                {generatingInvite ? "GENERATING..." : "GENERATE MISSION CODE"}
              </button>
            ) : (
              <div className="text-right">
                <p className="text-[10px] text-ui-muted font-black uppercase tracking-widest mb-2 flex items-center justify-end gap-1">
                  <Send className="w-3 h-3" /> Mission Access Code
                </p>
                <div className="flex items-center gap-2">
                  <div className="bg-sky-50 border border-sky-100 font-mono px-4 py-2 rounded-2xl text-sky-600 text-2xl font-black tracking-widest shadow-inner">
                    {invite.id}
                  </div>
                  <button 
                    onClick={handleCopy}
                    className={cn(
                      "p-3 rounded-2xl transition-all flex items-center justify-center border",
                      copied ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-white text-ui-secondary hover:bg-ui-soft border border-ui"
                    )}
                    title="Copy Code"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[9px] text-blue-400 font-bold mt-2 uppercase tracking-wide bg-blue-500/10 px-2 py-1 rounded-lg inline-block"
                >
                  {copied ? "COORDINATES COPIED!" : "SHARE CODE WITH SPACE CADET"}
                </motion.p>
              </div>
            )}
          </div>
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
        </div>

        <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-purple-500 flex flex-col justify-center relative overflow-hidden">
          <p className={cn("text-[10px] uppercase tracking-widest font-black mb-3", toneSecondary)}>Linked Cadets</p>
          <div className="flex -space-x-2 mb-4 flex-wrap">
            {kids.length > 0 ? kids.map((k: UserProfile) => (
              <div key={k.uid} className="relative group/kid mb-2">
                <div
                  className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold cursor-pointer", isDarkMode ? "bg-ui-dark-2 border-ui-dark-3 text-ui-secondary" : "bg-ui-soft-2 border-ui text-ui-secondary")}
                  title={`${k.name} - LVL ${k.level || 1}`}
                >
                  {k.name?.charAt(0)?.toUpperCase()}
                </div>
                {/* color dot */}
                <button
                  onClick={(e) => { e.stopPropagation(); setColorPickerFor(colorPickerFor === k.uid ? null : k.uid); }}
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: k.color ?? MEMBER_COLORS[0] }}
                  title="Set color"
                />
                {colorPickerFor === k.uid && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-ui rounded-xl p-2 shadow-xl grid grid-cols-4 gap-1" onClick={e => e.stopPropagation()}>
                    {MEMBER_COLORS.map(c => (
                      <button key={c} onClick={async () => { await userService.setMemberColor(k.uid, c); setColorPickerFor(null); fetchData(); }}
                        className="w-6 h-6 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
            )) : (
              <div className="w-10 h-10 rounded-full bg-ui-dark border-2 border-dashed border-ui-dark-2 flex items-center justify-center text-ui-secondary mb-2">
                <Plus className="w-4 h-4" />
              </div>
            )}
          </div>
          
          <AddKidForm parentId={profile.uid} onAdded={fetchData} />
          
          <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-500/5 blur-xl rounded-full" />
        </div>
      </div>

      <ConnectedAccountsView 
        connections={connections} 
        calendars={syncCalendars}
        onToggleCalendar={handleToggleCalendar}
        onConnect={async (provider, data) => {
          const tk = localStorage.getItem('kidtasker_token');
          if (provider === 'google') {
            window.location.href = `/api/sync/connect/google?token=${tk}`;
          } else if (provider === 'manual') {
            try {
              const res = await fetchAPI('/sync/connect/manual', {
                method: 'POST',
                body: JSON.stringify(data)
              });
              alert('Manual sync connection established!');
              fetchData();
            } catch (err) {
              alert('Failed to connect');
            }
          }
        }} 
        onDisconnect={handleDisconnect} 
      />

      {pendingCompletions.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2.5rem] space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-700">Awaiting Approval</h3>
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingCompletions.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingCompletions.map((comp: any) => (
              <div key={comp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex justify-between items-center group">
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase mb-1">{comp.kidName}</p>
                  <p className="font-bold text-ui-primary text-sm">{comp.taskTitle}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => rejectCompletion(comp.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Reject"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => approveCompletion(comp.id)}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-ui-soft p-2 rounded-2xl">
        <div className="flex gap-2 items-center">
          <div className={cn("flex gap-1 p-1 rounded-xl mr-2", isDarkMode ? "bg-ui-dark-50" : "bg-ui-soft-2")}>
            <button 
              onClick={() => setSortBy('time')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'time' ? "bg-sky-500 text-white shadow-md" : (isDarkMode ? "text-ui-secondary hover:text-white hover:bg-ui-dark-2" : "text-ui-muted hover:text-ui-secondary hover:bg-ui-soft")
              )}
            >
              <Clock className="w-3 h-3" /> Time
            </button>
            <button 
              onClick={() => setSortBy('created')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'created' ? "bg-sky-500 text-white shadow-md" : (isDarkMode ? "text-ui-secondary hover:text-white hover:bg-ui-dark-2" : "text-ui-muted hover:text-ui-secondary hover:bg-ui-soft")
              )}
            >
              <CalendarDays className="w-3 h-3" /> New
            </button>
          </div>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => onCategoriesChange(categories)} // Dummy for now
              className="p-2 rounded-xl hover:bg-ui-dark-2 transition-colors"
              title={cat.name}
            >
              <span className="text-xl">{cat.icon}</span>
            </button>
          ))}
          <button 
            onClick={() => setIsManagingCategories(true)}
            className="p-2 bg-white rounded-xl text-ui-muted hover:bg-ui-soft border border-ui transition-colors shadow-sm"
          >
            <Tag className="w-5 h-5" />
          </button>
        </div>
        
        {!isLocked && (
          <button 
            onClick={() => setIsAddingTask(true)}
            className="btn-immersive-primary !w-auto bg-blue-600 px-6 py-2 text-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Objective
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full text-center py-20 glass-panel rounded-[40px] border-dashed">
            <Calendar className={cn("w-12 h-12 mx-auto mb-4", isDarkMode ? "text-ui-muted-2" : "text-ui-secondary")} />
            <p className={cn(isDarkMode ? "text-ui-secondary" : "text-ui-muted")}>No active missions in sector.</p>
          </div>
        ) : (
          filteredTasks.map((task: Task) => {
            const category = categories.find(c => c.id === task.categoryId);
            return (
              <div key={task.id} className="card-immersive border-l-slate-700 group transition-all hover:scale-[1.01]">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center mb-2">
                      <span className={cn("text-[10px] border font-bold px-2 py-1 rounded uppercase tracking-wider", isDarkMode ? "bg-ui-dark-2 border-ui-dark-2 text-ui-secondary" : "bg-ui-soft-2 border-ui text-ui-muted")}>
                        {task.frequency}
                      </span>
                      {category && (
                        <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider", category.color, "text-white")}>
                          {category.icon} {category.name}
                        </span>
                      )}
                      {task.reminderTime && (
                        <span className="text-[10px] bg-sky-50 border border-sky-100 text-sky-600 font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {task.reminderTime}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xl font-bold">{task.title}</h4>
                  </div>
                  {!isLocked && (
                    <button 
                      onClick={() => archiveTask(task.id)}
                      className="p-2 text-ui-secondary hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className={cn("w-full py-2 border font-black rounded-xl text-center uppercase tracking-widest text-[10px]", isDarkMode ? "bg-ui-dark-70 border-ui-dark-2 text-ui-secondary" : "bg-ui-soft border-ui text-ui-muted")}>
                  Monitoring Active
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isAddingTask && (
          <AddTaskModal
            onClose={() => setIsAddingTask(false)}
            onSubmit={addTask}
            kids={kids}
            parentId={profile.uid}
            categories={categories}
            existingTasks={tasks}
          />
        )}
        {isManagingCategories && (
          <CategoryManager
            parentId={profile.uid}
            categories={categories}
            onClose={() => setIsManagingCategories(false)}
            onUpdate={onCategoriesChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


