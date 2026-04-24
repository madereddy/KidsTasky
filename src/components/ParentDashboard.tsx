import React, { useState, useEffect } from 'react';
import { Trash2, Calendar, Clock, CalendarDays, Tag, Plus, ShieldCheck, Bell, Send, CheckCircle2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Task, UserProfile, Category, Invite, Notification, Reward, TaskFrequency, TaskDifficulty } from '../types';
import { taskService } from '../services/taskService';
import { AddTaskModal } from './AddTaskModal';
import { CategoryManager } from './CategoryManager';
import { RewardManager } from './RewardManager';

export function ParentDashboard({ 
  profile, 
  categories, 
  onCategoriesChange,
  selectedCategoryId
}: { 
  profile: UserProfile, 
  categories: Category[],
  onCategoriesChange: (cats: Category[]) => void,
  selectedCategoryId: string | null
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kids, setKids] = useState<UserProfile[]>([]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'created'>('created');
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [t, k, i, n, r] = await Promise.all([
        taskService.getTasksForParent(profile.uid),
        taskService.getKidsForParent(profile.uid),
        taskService.getActiveInvite(profile.uid),
        taskService.getUnreadNotifications(profile.uid),
        taskService.getRewards(profile.uid)
      ]);
      setTasks(t || []);
      setKids(k || []);
      setInvite(i);
      setNotifications(n || []);
      setRewards(r || []);
      setLoading(false);
    };
    fetchData();

    // Poll for notifications every minute
    const interval = setInterval(async () => {
      const n = await taskService.getUnreadNotifications(profile.uid);
      setNotifications(n || []);
    }, 60000);

    return () => clearInterval(interval);
  }, [profile.uid]);

  const markRead = async (id: string) => {
    await taskService.markNotificationRead(id);
    setNotifications(notifications.filter((n: Notification) => n.id !== id));
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    await taskService.createInvite(profile.uid, profile.name);
    const updatedInvite = await taskService.getActiveInvite(profile.uid);
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
    await taskService.createTask(task);
    const updated = await taskService.getTasksForParent(profile.uid);
    setTasks(updated);
    setIsAddingTask(false);
  };

  const refreshRewards = async () => {
    const r = await taskService.getRewards(profile.uid);
    setRewards(r || []);
  };

  const archiveTask = async (id: string) => {
    await taskService.archiveTask(id);
    setTasks(tasks.filter((t: Task) => t.id !== id));
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
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

  return (
    <div className="space-y-8">
      <RewardManager parentId={profile.uid} rewards={rewards} onUpdate={refreshRewards} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-panel p-6 rounded-3xl border-l-4 border-l-blue-500 flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-2">Ground Control Command</h3>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl relative">
                <ShieldCheck className="w-6 h-6 text-blue-500" />
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 hover:border-amber-500 transition-colors"
                >
                  <Bell className={cn("w-3 h-3", notifications.length > 0 ? "text-amber-500 animate-pulse" : "text-slate-400")} />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-slate-900" />
                  )}
                </button>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Sector Commander</p>
                <p className="font-bold text-white leading-none">{profile.name}</p>
              </div>
            </div>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-4 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[100] max-h-[300px] overflow-y-auto"
                >
                  <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Tactical Alerts</span>
                    <span className="text-[8px] font-bold text-amber-500">{notifications.length} NEW</span>
                  </div>
                  <div className="p-1 space-y-1">
                    {notifications.length === 0 ? (
                       <div className="p-4 text-center">
                         <p className="text-[8px] text-slate-600 uppercase font-bold">No breaches detected</p>
                       </div>
                    ) : (
                      notifications.map((n: Notification) => (
                        <div key={n.id} className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/50 flex flex-col gap-2 group">
                          <div>
                            <p className="text-[7px] font-black text-amber-500 uppercase mb-0.5">Overdue Objective</p>
                            <p className="text-white font-bold text-[9px] leading-tight truncate">{n.taskTitle}</p>
                            <p className="text-slate-500 text-[8px] uppercase font-bold tracking-tight">Cadet: {n.kidName}</p>
                          </div>
                          <button 
                            onClick={() => markRead(n.id)}
                            className="text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest text-left"
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
                className="btn-immersive-primary !w-auto bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/40 px-6 py-2 text-[10px]"
              >
                {generatingInvite ? "GENERATING..." : "GENERATE MISSION CODE"}
              </button>
            ) : (
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center justify-end gap-1">
                  <Send className="w-3 h-3" /> Mission Access Code
                </p>
                <div className="flex items-center gap-2">
                  <div className="bg-slate-900 border border-slate-700 font-mono px-4 py-2 rounded-2xl text-blue-400 text-2xl font-black tracking-widest glow-blue">
                    {invite.id}
                  </div>
                  <button 
                    onClick={handleCopy}
                    className={cn(
                      "p-3 rounded-2xl transition-all flex items-center justify-center border",
                      copied ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
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
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-3">Linked Cadets</p>
          <div className="flex -space-x-2 mb-4">
            {kids.length > 0 ? kids.map((k: UserProfile) => (
              <div 
                key={k.uid}
                className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-300 relative group/kid"
                title={`${k.name} - LVL ${k.level || 1}`}
              >
                {k.name[0].toUpperCase()}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full border border-slate-900 text-[6px] flex items-center justify-center text-white scale-0 group-hover/kid:scale-100 transition-transform">
                  {k.level || 1}
                </div>
              </div>
            )) : (
              <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-700">
                <Plus className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[9px] text-purple-400 font-bold uppercase tracking-tight">{kids.length} Cadets Under Command</p>
            <p className="text-[8px] text-slate-500 italic max-w-[150px] leading-tight">
              Instruct cadets to enter your Mission Code during initial sequence.
            </p>
          </div>
          <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-500/5 blur-xl rounded-full" />
        </div>
      </div>

      <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded-2xl">
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl mr-2">
            <button 
              onClick={() => setSortBy('time')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'time' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Clock className="w-3 h-3" /> Time
            </button>
            <button 
              onClick={() => setSortBy('created')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'created' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <CalendarDays className="w-3 h-3" /> New
            </button>
          </div>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => onCategoriesChange(categories)} // Dummy for now
              className="p-2 rounded-xl hover:bg-slate-800 transition-colors"
              title={cat.name}
            >
              <span className="text-xl">{cat.icon}</span>
            </button>
          ))}
          <button 
            onClick={() => setIsManagingCategories(true)}
            className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <Tag className="w-5 h-5" />
          </button>
        </div>
        
        <button 
          onClick={() => setIsAddingTask(true)}
          className="btn-immersive-primary !w-auto bg-blue-600 px-6 py-2 text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Objective
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full text-center py-20 glass-panel rounded-[40px] border-dashed">
            <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500">No active missions in sector.</p>
          </div>
        ) : (
          filteredTasks.map((task: Task) => {
            const category = categories.find(c => c.id === task.categoryId);
            return (
              <div key={task.id} className="card-immersive border-l-slate-700 group transition-all hover:scale-[1.01]">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center mb-2">
                      <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-2 py-1 rounded uppercase tracking-wider">
                        {task.frequency}
                      </span>
                      {category && (
                        <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider", category.color, "text-white")}>
                          {category.icon} {category.name}
                        </span>
                      )}
                      {task.reminderTime && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {task.reminderTime}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xl font-bold">{task.title}</h4>
                  </div>
                  <button 
                    onClick={() => archiveTask(task.id)}
                    className="p-2 text-slate-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="w-full py-2 bg-slate-900 border border-slate-800 text-slate-500 font-black rounded-xl text-center uppercase tracking-widest text-[10px]">
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
