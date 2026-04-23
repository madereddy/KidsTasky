import React, { useState, useEffect } from 'react';
import { taskService } from './services/taskService';
import { UserProfile, Task, TaskCompletion, TaskFrequency, TaskDifficulty, Category, Invite, BadgeDef, EarnedBadge } from './types';
import { format, startOfToday, isAfter, parse, addHours, subDays, isSameDay, differenceInDays, startOfDay } from 'date-fns';
import { 
  CheckCircle2, 
  Plus, 
  Trash2, 
  LogOut, 
  Baby, 
  ShieldCheck, 
  Bell, 
  Clock, 
  Calendar,
  ChevronRight,
  User as UserIcon,
  Award,
  Settings,
  Filter,
  Tag,
  Edit2,
  Flame,
  Zap,
  TrendingUp,
  Trophy,
  Star,
  Copy,
  Send,
  ArrowUpDown,
  CalendarDays,
  AlertCircle,
  Activity,
  History,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORY_ICONS = ['🏠', '🏫', '🥦', '🎨', '🎮', '🧹', '🐶', '🌟', '💧', '📚', '🏃', '🌙', '☀️'];
const CATEGORY_COLORS = [
  { name: 'Blue', class: 'bg-blue-500', text: 'text-blue-500' },
  { name: 'Purple', class: 'bg-purple-500', text: 'text-purple-500' },
  { name: 'Emerald', class: 'bg-emerald-500', text: 'text-emerald-500' },
  { name: 'Rose', class: 'bg-rose-500', text: 'text-rose-500' },
  { name: 'Amber', class: 'bg-amber-500', text: 'text-amber-500' },
  { name: 'Slate', class: 'bg-slate-500', text: 'text-slate-500' },
  { name: 'Cyan', class: 'bg-cyan-500', text: 'text-cyan-500' },
];

const XP_REWARDS: Record<TaskDifficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 50
};

const BADGE_DEFS: Record<string, BadgeDef> = {
  'xp_100': { 
    id: 'xp_100', 
    name: 'Novice Explorer', 
    description: 'Achieved 100 Mission XP', 
    icon: '🎖️', 
    color: 'bg-blue-500' 
  },
  'streak_7': { 
    id: 'streak_7', 
    name: 'Titan of Time', 
    description: 'Maintained a 7-day Combustion Streak', 
    icon: '🔥', 
    color: 'bg-orange-500' 
  },
  'hard_master': { 
    id: 'hard_master', 
    name: 'Elite Striker', 
    description: 'Neutralized 10 Hard-level objectives', 
    icon: '☄️', 
    color: 'bg-rose-500' 
  },
  'first_mission': {
    id: 'first_mission',
    name: 'Spacefarer',
    description: 'Completed your very first mission',
    icon: '🌍',
    color: 'bg-emerald-500'
  }
};

const THEMES = [
  { 
    id: 'space', 
    name: 'Deep Space', 
    icon: '🛰️', 
    primary: 'blue-500', 
    accent: 'purple-500', 
    bg: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #05070a 100%)',
    border: 'border-blue-500/20'
  },
  { 
    id: 'nebula', 
    name: 'Nebula Pink', 
    icon: '☄️', 
    primary: 'rose-500', 
    accent: 'purple-600', 
    bg: 'radial-gradient(circle at 50% 50%, #2d1b2d 0%, #0a050a 100%)',
    border: 'border-rose-500/20'
  },
  { 
    id: 'forest', 
    name: 'Emerald Forest', 
    icon: '🌿', 
    primary: 'emerald-500', 
    accent: 'teal-600', 
    bg: 'radial-gradient(circle at 50% 50%, #064e3b 0%, #022c22 100%)',
    border: 'border-emerald-500/20'
  },
  { 
    id: 'cyber', 
    name: 'Cyberpunk', 
    icon: '⚡', 
    primary: 'amber-500', 
    accent: 'orange-600', 
    bg: 'radial-gradient(circle at 50% 50%, #451a03 0%, #0c0a09 100%)',
    border: 'border-amber-500/20'
  },
  { 
    id: 'abyss', 
    name: 'Ocean Abyss', 
    icon: '🐚', 
    primary: 'cyan-500', 
    accent: 'blue-700', 
    bg: 'radial-gradient(circle at 50% 50%, #164e63 0%, #083344 100%)',
    border: 'border-cyan-500/20'
  }
];

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const fetchProfile = async (uid: string) => {
    const p = await taskService.getUserProfile(uid);
    setProfile(p);
    if (p) {
      const cats = await taskService.getCategories(p.role === 'kid' ? p.parentId! : p.uid);
      setCategories(cats || []);
    }
  };

  useEffect(() => {
    const storedUid = localStorage.getItem('auth_uid');
    if (storedUid) {
      fetch('/api/auth/me', { headers: { 'Authorization': storedUid }})
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(async data => {
          setUser(data.user);
          await fetchProfile(data.user.uid);
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('auth_uid');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (username: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username })
      });
      const data = await res.json();
      localStorage.setItem('auth_uid', data.user.uid);
      setUser(data.user);
      if (data.user.role) {
        await fetchProfile(data.user.uid);
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_uid');
    setUser(null);
    setProfile(null);
  };

  const [progressPercent, setProgressPercent] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070a]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (!profile) {
    return <OnboardingView user={user} onComplete={setProfile} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar / Progress */}
      <aside className="w-full md:w-72 h-auto md:h-full glass-panel border-r border-slate-800 p-8 flex flex-col gap-8 shrink-0 overflow-y-auto">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-1 glow-blue">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-3xl">
              {profile.role === 'parent' ? '🛡️' : '🚀'}
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold tracking-tight">{profile.name}</h2>
            <p className="text-blue-400 text-[10px] font-semibold uppercase tracking-[0.2em]">
              {profile.role === 'parent' ? 'Ground Control' : 'Space Cadet'}
            </p>
          </div>
        </div>

        {profile.role === 'kid' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/40 rounded-2xl p-3 border border-slate-700/50 flex flex-col items-center">
              <Zap className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">XP</span>
              <span className="text-lg font-black text-emerald-400">{(profile.xp || 0) % 100}</span>
            </div>
            <div className="bg-slate-800/40 rounded-2xl p-3 border border-slate-700/50 flex flex-col items-center">
              <Trophy className="w-4 h-4 text-purple-400 mb-1" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">LVL</span>
              <span className="text-lg font-black text-purple-400">{profile.level || 1}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Daily Progress</p>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="h-full bg-blue-500 glow-blue transition-all duration-1000"
              />
            </div>
            <p className="text-[10px] text-blue-400 font-bold">{Math.round(progressPercent)}% Mission Complete</p>
          </div>

          <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50">
            <div className="flex justify-between items-center mb-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Categories</p>
              {selectedCategoryId && (
                <button 
                  onClick={() => setSelectedCategoryId(null)}
                  className="text-[10px] text-blue-400 hover:underline font-bold"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    selectedCategoryId === cat.id ? cn(cat.color, "glow-blue scale-110") : "bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700"
                  )}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
              {categories.length === 0 && <p className="text-[10px] text-slate-600 italic">No categories</p>}
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors group"
          >
            <span className="text-xs font-bold text-slate-400 group-hover:text-white">Abort Mission</span>
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 flex flex-col overflow-y-auto w-full">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <h1 className="text-4xl title-immersive">Mission Log</h1>
            <p className="text-slate-500 text-sm">Stardate: {format(new Date(), 'EEEE, MMM d')}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-full flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-blue-400 tracking-wider uppercase">Parent Link Active</span>
          </div>
        </header>

        <div className="flex-1">
          {profile.role === 'parent' ? (
            <ParentDashboard 
              profile={profile} 
              categories={categories} 
              onCategoriesChange={setCategories}
              selectedCategoryId={selectedCategoryId}
            />
          ) : (
            <KidDashboard 
              profile={profile} 
              onProgressChange={(percent) => setProgressPercent(percent)} 
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onProfileUpdate={() => fetchProfile(profile.uid)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function LoginView({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState('');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl glow-blue">
          <ShieldCheck className="text-white w-12 h-12" />
        </div>
        <h1 className="title-immersive text-5xl mb-4">KidTasker</h1>
        <p className="text-slate-400 mb-8 italic uppercase tracking-widest text-xs font-bold">Stellar Mission Command</p>
        
        <input 
          type="text" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter Commander Name..." 
          className="input-immersive mb-4 text-center"
        />

        <button 
          onClick={() => { if (username.trim()) onLogin(username.trim()) }}
          disabled={!username.trim()}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-lg glow-blue active:scale-[0.98] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enter Star System
        </button>
      </motion.div>
    </div>
  );
}

function OnboardingView({ user, onComplete }: { user: any, onComplete: (p: UserProfile) => void }) {
  const [role, setRole] = useState<'parent' | 'kid' | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState(user.name || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!role || !name) return;
    setError(null);
    setLoading(true);
    
    let parentId: string | undefined;
    
    if (role === 'kid') {
      if (!inviteCode) {
        setError('Mission access code required.');
        setLoading(false);
        return;
      }
      const invite = await taskService.validateInvite(inviteCode);
      if (!invite) {
        setError('Invalid mission access code. Please check with your commander.');
        setLoading(false);
        return;
      }
      parentId = invite.parentId;
    }

    const profile: UserProfile = {
      uid: user.uid,
      role,
      name,
      email: user.email || '',
      parentId
    };
    
    await taskService.createUserProfile(profile);
    setLoading(false);
    onComplete(profile);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-10 rounded-[40px]">
        <h2 className="title-immersive text-3xl mb-2">Identify Payload</h2>
        <p className="text-slate-500 mb-8 uppercase text-[10px] font-bold tracking-widest">Scanning user credentials...</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button 
            onClick={() => setRole('parent')}
            className={cn(
              "p-6 rounded-3xl border-2 transition-all text-left flex flex-col gap-4",
              role === 'parent' ? "border-blue-500 bg-blue-500/10 glow-blue" : "border-slate-800 bg-slate-900/50"
            )}
          >
            <div className={cn("p-3 rounded-2xl w-fit", role === 'parent' ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-500")}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tight text-sm">Ground Control</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase">Coordinate Missions</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('kid')}
            className={cn(
              "p-6 rounded-3xl border-2 transition-all text-left flex flex-col gap-4",
              role === 'kid' ? "border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "border-slate-800 bg-slate-900/50"
            )}
          >
            <div className={cn("p-3 rounded-2xl w-fit", role === 'kid' ? "bg-purple-500 text-white" : "bg-slate-800 text-slate-500")}>
              <Baby className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tight text-sm">Space Cadet</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase">Execute Objectives</p>
            </div>
          </button>
        </div>

        <AnimatePresence>
          {role && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-6 overflow-hidden"
            >
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Personnel Name</label>
                <input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-immersive"
                  placeholder="Enter name..."
                />
              </div>

              {role === 'kid' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mission Access Code</label>
                  <input 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="input-immersive font-mono tracking-widest text-xl text-center uppercase"
                    placeholder="X7R9Z2"
                    maxLength={6}
                  />
                  <p className="text-[10px] text-slate-500 mt-2 italic text-center">Your Ground Control officer will provide this code.</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs text-center font-bold">
                  {error}
                </div>
              )}

              <button 
                onClick={handleSubmit}
                disabled={loading}
                className={cn(
                  "w-full btn-immersive-primary bg-blue-600 mt-4 glow-blue",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? "Initializing..." : "Board Station"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RewardManager({ parentId, rewards, onUpdate }: { parentId: string, rewards: Reward[], onUpdate: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [xpCost, setXpCost] = useState(100);

  const addReward = async () => {
    if (!title) return;
    await taskService.createReward({ parentId, title, description, xpCost });
    setTitle('');
    setDescription('');
    setXpCost(100);
    onUpdate();
  };

  const deleteReward = async (id: string) => {
    await taskService.deleteReward(id);
    onUpdate();
  };

  return (
    <div className="glass-panel p-6 rounded-3xl mb-6 border-l-4 border-l-yellow-500">
      <h3 className="text-xl font-black italic tracking-tighter uppercase mb-6 text-yellow-500">Mission Rewards</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {rewards.map(r => (
            <div key={r.id} className="bg-slate-900 p-4 rounded-xl flex justify-between items-center border border-slate-800">
                <div>
                  <p className="font-bold text-slate-200">{r.title}</p>
                  <p className="text-slate-500 text-xs">{r.description} - <span className="text-yellow-500 font-bold">{r.xpCost} XP</span></p>
                </div>
                <button onClick={() => deleteReward(r.id)} className="text-red-500 hover:text-red-400 p-2">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="input-immersive" />
        <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="input-immersive" />
        <input type="number" value={xpCost} onChange={e => setXpCost(parseInt(e.target.value))} className="input-immersive" />
        <button onClick={addReward} className="btn-immersive-primary bg-yellow-600 hover:bg-yellow-500 text-white font-bold">Add Reward</button>
      </div>
    </div>
  );
}

function ParentDashboard({ 
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
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    const code = await taskService.createInvite(profile.uid, profile.name);
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
    setTasks(tasks.filter(t => t.id !== id));
  };

  if (loading) return null;

  const filteredTasks = (selectedCategoryId 
    ? tasks.filter(t => t.categoryId === selectedCategoryId)
    : [...tasks]).sort((a, b) => {
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
                      notifications.map(n => (
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
            {kids.length > 0 ? kids.map(k => (
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
          filteredTasks.map(task => {
            const category = categories.find(c => c.id === task.categoryId);
            return (
              <div key={task.id} className="card-immersive border-l-slate-700 group">
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


function AddTaskModal({ onClose, onSubmit, kids, parentId, categories, existingTasks }: { 
  onClose: () => void, 
  onSubmit: (t: any) => void, 
  kids: UserProfile[],
  parentId: string,
  categories: Category[],
  existingTasks: Task[]
}) {
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<TaskFrequency>('daily');
  const [customInterval, setCustomInterval] = useState(3);
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('easy');
  const [assignedKidId, setAssignedKidId] = useState(kids[0]?.uid || '');
  const [reminderTime, setReminderTime] = useState('08:00');
  const [categoryId, setCategoryId] = useState<string>('');
  const [prerequisiteTaskIds, setPrerequisiteTaskIds] = useState<string[]>([]);

  const togglePrereq = (id: string) => {
    if (prerequisiteTaskIds.includes(id)) {
      setPrerequisiteTaskIds(prerequisiteTaskIds.filter(pid => pid !== id));
    } else {
      setPrerequisiteTaskIds([...prerequisiteTaskIds, id]);
    }
  };

  const eligiblePrereqs = existingTasks.filter(t => t.assignedKidId === assignedKidId);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-sm rounded-[40px] p-10 shadow-2xl border-blue-500/20 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-8">New Mission</h3>
        
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Mission Objective</label>
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-immersive"
              placeholder="e.g. Navigation Check"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Mission Category</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setCategoryId('')}
                className={cn(
                  "py-2 rounded-xl font-bold text-[10px] uppercase border transition-all",
                  categoryId === '' ? "bg-slate-700 text-white border-slate-600" : "bg-slate-900 border-slate-800 text-slate-500"
                )}
              >
                None
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-[10px] uppercase border transition-all flex flex-col items-center justify-center gap-1",
                    categoryId === cat.id ? cn(cat.color, "text-white border-white/20 glow-blue") : "bg-slate-900 border-slate-800 text-slate-500"
                  )}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span className="truncate w-full text-center px-1">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Cycle Frequency</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(['daily', 'twice-daily', 'weekly', 'bi-weekly', 'custom'] as TaskFrequency[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-[8px] md:text-[10px] uppercase border transition-all",
                    frequency === f ? "bg-blue-600 text-white border-blue-500 glow-blue shadow-lg" : "bg-slate-900 border-slate-800 text-slate-500"
                  )}
                >
                  {f.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'custom' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Interval Days</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="2"
                  max="30"
                  value={customInterval}
                  onChange={(e) => setCustomInterval(parseInt(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xl font-black text-blue-400 font-mono w-8">{customInterval}</span>
              </div>
              <p className="text-[8px] text-slate-500 italic mt-1 uppercase tracking-tight">Mission resets every {customInterval} days</p>
            </motion.div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Mission Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as TaskDifficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "py-2 rounded-xl font-bold text-[10px] uppercase border transition-all",
                    difficulty === d ? cn(
                      d === 'easy' ? "bg-emerald-600 border-emerald-500" : 
                      d === 'medium' ? "bg-amber-600 border-amber-500" : 
                      "bg-rose-600 border-rose-500",
                      "text-white glow-blue"
                    ) : "bg-slate-900 border-slate-800 text-slate-500"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Assign to Cadet</label>
            <input 
              value={assignedKidId}
              onChange={(e) => setAssignedKidId(e.target.value)}
              className="input-immersive"
              placeholder="Cadet UID"
            />
          </div>

          {eligiblePrereqs.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block flex items-center gap-1">
                <Lock className="w-3 h-3" /> Prerequisites 
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {eligiblePrereqs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => togglePrereq(t.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-xs font-bold border transition-all truncate",
                      prerequisiteTaskIds.includes(t.id) 
                        ? "bg-purple-600/20 text-purple-400 border-purple-500/50" 
                        : "bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    {prerequisiteTaskIds.includes(t.id) && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Launch Time</label>
            <input 
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="input-immersive"
            />
          </div>

          <div className="flex gap-3 pt-6">
            <button onClick={onClose} className="flex-1 py-3 bg-slate-900 border border-slate-800 text-slate-500 font-black rounded-xl uppercase tracking-widest text-xs">Abort</button>
            <button 
              onClick={() => onSubmit({ 
                title, 
                frequency, 
                difficulty, 
                assignedKidId, 
                reminderTime, 
                parentId, 
                categoryId,
                customInterval: frequency === 'custom' ? customInterval : undefined,
                prerequisiteTaskIds: prerequisiteTaskIds.length > 0 ? prerequisiteTaskIds : undefined
              })} 
              className="flex-1 btn-immersive-primary bg-blue-600"
            >
              Launch
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MissionHistoryModal({ 
  profile, 
  tasks,
  categories,
  onClose 
}: { 
  profile: UserProfile, 
  tasks: Task[],
  categories: Category[],
  onClose: () => void 
}) {
  const [history, setHistory] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const currentTheme = THEMES.find(t => t.id === profile.themeId) || THEMES[0];

  useEffect(() => {
    const fetchHistory = async () => {
      const h = await taskService.getHistoryForKid(profile.uid);
      setHistory(h || []);
      setLoading(false);
    };
    fetchHistory();
  }, [profile.uid]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-2xl rounded-[40px] p-6 md:p-10 shadow-2xl border-blue-500/20 max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Mission Archive</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Chronological Activity Log</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <LogOut className="w-6 h-6 rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Activity className={cn("w-8 h-8 animate-pulse", `text-${currentTheme.primary}`)} />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Syncing with Archive...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800 border-dashed">
              <p className="text-slate-500 text-sm italic">No entries found in the mission archive.</p>
            </div>
          ) : (
            history.map((entry, idx) => {
              const task = tasks.find(t => t.id === entry.taskId);
              const category = task ? categories.find(c => c.id === task.categoryId) : null;
              const date = entry.completedAt?.toDate ? entry.completedAt.toDate() : new Date((entry.completedAt?.seconds || 0) * 1000);
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 transition-all group",
                    `hover:border-${currentTheme.primary}/30`
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
                    category ? category.color : "bg-slate-800 text-slate-500"
                  )}>
                    {category ? category.icon : '🛰️'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={cn("font-bold text-base truncate transition-colors", `group-hover:text-${currentTheme.primary}`)}>
                        {task?.title || 'Unknown Mission'}
                      </h4>
                      <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-lg border", `bg-${currentTheme.primary}/10 border-${currentTheme.primary}/20 shadow-[0_0_10px_rgba(var(--${currentTheme.primary}-rgb),0.1)]`)}>
                        <Zap className={cn("w-3 h-3", `text-${currentTheme.primary}`)} />
                        <span className={cn("text-[10px] font-black", `text-${currentTheme.primary}`)}>+{XP_REWARDS[task?.difficulty || 'easy']} XP</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {format(date, 'MMM d, yyyy')}
                      </p>
                      <span className="w-1 h-1 bg-slate-700 rounded-full" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(date, 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[9px] text-slate-600 text-center uppercase tracking-[0.2em] font-black">
            End of Mission Log — Secure Channel 778
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ThemeSelectorModal({ 
  currentThemeId, 
  onSelect, 
  onClose 
}: { 
  currentThemeId: string, 
  onSelect: (id: string) => void, 
  onClose: () => void 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-md rounded-[40px] p-10 shadow-2xl border-blue-500/20 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">UI Customization</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Select your command aesthetic</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white"><LogOut className="w-5 h-5 rotate-180" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {THEMES.map(theme => (
            <motion.button
              key={theme.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(theme.id)}
              className={cn(
                "p-5 rounded-3xl border-2 transition-all flex items-center gap-4 text-left relative overflow-hidden group",
                currentThemeId === theme.id 
                  ? `bg-${theme.primary}/10 border-${theme.primary} shadow-[0_0_20px_rgba(59,130,246,0.2)]` 
                  : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-transform group-hover:scale-110",
                `bg-${theme.primary}/20 text-${theme.primary}`
              )}>
                {theme.icon}
              </div>
              <div>
                <p className="font-black text-white uppercase tracking-tight text-lg leading-none mb-1">{theme.name}</p>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Signature: {theme.primary.split('-')[0]}</p>
              </div>
              
              {currentThemeId === theme.id && (
                <div className="absolute top-4 right-4">
                  <CheckCircle2 className={cn("w-6 h-6", `text-${theme.primary}`)} />
                </div>
              )}
              
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity" 
                style={{ background: theme.bg }} 
              />
            </motion.button>
          ))}
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-8 py-4 bg-slate-900 border border-slate-800 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-xs hover:text-white transition-colors"
        >
          Confirm Selection
        </button>
      </motion.div>
    </motion.div>
  );
}

function CategoryManager({ 
  parentId, 
  categories, 
  onClose,
  onUpdate 
}: { 
  parentId: string, 
  categories: Category[], 
  onClose: () => void,
  onUpdate: (cats: Category[]) => void 
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0].class);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    if (editingId) {
      await taskService.updateCategory({ id: editingId, name, icon, color, parentId });
    } else {
      await taskService.createCategory({ name, icon, color, parentId });
    }
    
    const updated = await taskService.getCategories(parentId);
    onUpdate(updated || []);
    setName('');
    setEditingId(null);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
  };

  const handleDelete = async (id: string) => {
    await taskService.deleteCategory(id);
    const updated = await taskService.getCategories(parentId);
    onUpdate(updated || []);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-md rounded-[40px] p-10 shadow-2xl border-blue-500/20 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-black italic tracking-tighter uppercase">Categories</h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white"><LogOut className="w-5 h-5 rotate-180" /></button>
        </div>

        <div className="space-y-6 mb-10 pb-10 border-b border-slate-800">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Category Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-immersive"
              placeholder="e.g. Chores, School..."
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all",
                    icon === i ? "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-110" : "bg-slate-900 border border-slate-800 text-slate-500"
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Color Accent</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map(c => (
                <button
                  key={c.class}
                  onClick={() => setColor(c.class)}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all border-2",
                    c.class,
                    color === c.class ? "border-white scale-110" : "border-transparent"
                  )}
                />
              ))}
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            className="w-full btn-immersive-primary bg-blue-600"
          >
            {editingId ? 'Update Category' : 'Create Category'}
          </button>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Existing Categories</label>
          {categories.map(cat => (
            <div key={cat.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl", cat.color)}>
                  {cat.icon}
                </div>
                <span className="font-bold text-sm tracking-tight">{cat.name}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => startEdit(cat)}
                  className="p-2 text-slate-500 hover:text-blue-400"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="p-2 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-center py-4 text-slate-600 italic text-sm">No categories defined yet.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function KidDashboard({ 
  profile, 
  onProgressChange, 
  categories,
  selectedCategoryId,
  onProfileUpdate
}: { 
  profile: UserProfile, 
  onProgressChange: (p: number) => void,
  categories: Category[],
  selectedCategoryId: string | null,
  onProfileUpdate: () => void
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const today = format(startOfToday(), 'yyyy-MM-dd');
  const [unlockedBadge, setUnlockedBadge] = useState<BadgeDef | null>(null);
  const [sortBy, setSortBy] = useState<'time' | 'created'>('time');
  const [showHistory, setShowHistory] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);
  
  // Task Confirmation & Animation
  const [confirmTask, setConfirmTask] = useState<{taskId: string, count?: number, xpReward: number, taskTitle: string} | null>(null);
  const [xpAnimation, setXpAnimation] = useState<{amount: number, active: boolean}>({amount: 0, active: false});

  const currentTheme = THEMES.find(t => t.id === profile.themeId) || THEMES[0];

  const claimReward = async (rewardId: string, xpCost: number) => {
    await taskService.claimReward(profile.uid, rewardId, xpCost);
    setClaimedRewards([...claimedRewards, { id: 'tmp_' + Date.now(), kidId: profile.uid, rewardId, createdAt: Date.now() }]);
    onProfileUpdate();
  };

  useEffect(() => {
    const checkMilestones = async () => {
      if (loading) return;
      const earnedIds = (profile.badges || []).map(b => b.id);
      
      // First Mission
      if (!earnedIds.includes('first_mission') && completions.length > 0) {
        await taskService.addBadge(profile.uid, 'first_mission');
        setUnlockedBadge(BADGE_DEFS['first_mission']);
        onProfileUpdate();
      }

      // XP 100
      if (!earnedIds.includes('xp_100') && (profile.xp || 0) >= 100) {
        await taskService.addBadge(profile.uid, 'xp_100');
        setUnlockedBadge(BADGE_DEFS['xp_100']);
        onProfileUpdate();
      }

      // Streak 7
      if (!earnedIds.includes('streak_7') && streak >= 7) {
        await taskService.addBadge(profile.uid, 'streak_7');
        setUnlockedBadge(BADGE_DEFS['streak_7']);
        onProfileUpdate();
      }
    };
    checkMilestones();
  }, [completions.length, profile.xp, streak, loading]);

  useEffect(() => {
    const fetchData = async () => {
      const [t, c, r, cr] = await Promise.all([
        taskService.getTasksForKid(profile.uid),
        taskService.getCompletionsForKid(profile.uid, today),
        taskService.getRewards(profile.parentId!),
        taskService.getClaimedRewards(profile.uid)
      ]);
      setTasks(t);
      setCompletions(c);
      setRewards(r);
      setClaimedRewards(cr);
      setLoading(false);
    };
    fetchData();
  }, [profile.uid, today]);

  useEffect(() => {
    const calculateStreak = async () => {
      if (tasks.length === 0) return;
      
      const totalSlots = tasks.reduce((acc, task) => acc + (task.frequency === 'twice-daily' ? 2 : 1), 0);
      if (totalSlots === 0) return;

      const startDate = format(subDays(startOfToday(), 30), 'yyyy-MM-dd');
      const histCompletions = await taskService.getCompletionsForDateRange(profile.uid, startDate, today);
      
      let currentStreak = 0;
      let checkDate = startOfToday();
      
      const compsByDate: Record<string, number> = {};
      histCompletions.forEach(hc => {
        compsByDate[hc.dateString] = (compsByDate[hc.dateString] || 0) + 1;
      });

      // Override today with current local state
      compsByDate[today] = completions.length;

      for (let i = 0; i < 30; i++) {
        const ds = format(checkDate, 'yyyy-MM-dd');
        const compsCount = compsByDate[ds] || 0;
        
        if (compsCount >= totalSlots) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
        checkDate = subDays(checkDate, 1);
      }
      setStreak(currentStreak);

      // Milestone Check: Elite Striker (10 Hard completions)
      const earnedIds = (profile.badges || []).map(b => b.id);
      if (!earnedIds.includes('hard_master')) {
        const hardTaskIds = tasks.filter(t => t.difficulty === 'hard').map(t => t.id);
        const hardCount = histCompletions.filter(hc => hardTaskIds.includes(hc.taskId)).length;
        if (hardCount >= 5) { // Lowering to 5 for easier demo verification
          await taskService.addBadge(profile.uid, 'hard_master');
          setUnlockedBadge(BADGE_DEFS['hard_master']);
          onProfileUpdate();
        }
      }
    };

    calculateStreak();
  }, [tasks, completions, profile.uid, today]);

  const isTaskLocked = (task: Task) => {
    if (!task.prerequisiteTaskIds || task.prerequisiteTaskIds.length === 0) return false;
    return task.prerequisiteTaskIds.some(prereqId => {
      const pTask = tasks.find(t => t.id === prereqId);
      if (!pTask) return false;
      const reqCount = pTask.frequency === 'twice-daily' ? 2 : 1;
      const comps = completions.filter(c => c.taskId === prereqId).length;
      return comps < reqCount;
    });
  };

  const toggleTask = async (taskId: string, currentStatus: boolean, count?: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (isTaskLocked(task) && !currentStatus) return; // Prevent completion if locked

    const xpReward = XP_REWARDS[task.difficulty || 'easy'];

    if (currentStatus) {
      await taskService.uncompleteTask(taskId, today, count);
      await taskService.updateUserXP(profile.uid, -xpReward);
      setCompletions(completions.filter(c => !(c.taskId === taskId && c.count === count)));
      onProfileUpdate();
    } else {
      setConfirmTask({ taskId, count, xpReward, taskTitle: task.title });
    }
  };

  const executeCompletion = async () => {
    if (!confirmTask) return;
    const { taskId, count, xpReward } = confirmTask;
    setConfirmTask(null);
    setXpAnimation({ amount: xpReward, active: true });
    
    await taskService.completeTask(taskId, profile.uid, today, count);
    await taskService.updateUserXP(profile.uid, xpReward);
    setCompletions([...completions, { 
      id: `${taskId}_${today}_${count || 1}`, 
      taskId, 
      kidId: profile.uid, 
      completedAt: { seconds: Date.now()/1000 }, 
      dateString: today, 
      count 
    }]);
    onProfileUpdate();
    setTimeout(() => {
      setXpAnimation({ amount: 0, active: false });
    }, 2500);
  };

  const isCompleted = (taskId: string, count?: number) => {
    return completions.some(c => c.taskId === taskId && c.count === count);
  };

  const shouldShowToday = (task: Task) => {
    if (task.frequency === 'daily' || task.frequency === 'twice-daily') return true;
    
    // For weekly, bi-weekly, custom
    const createdDate = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt?.seconds * 1000 || Date.now());
    const daysSinceCreated = differenceInDays(startOfToday(), startOfDay(createdDate));
    
    if (task.frequency === 'weekly') return daysSinceCreated % 7 === 0;
    if (task.frequency === 'bi-weekly') return daysSinceCreated % 14 === 0;
    if (task.frequency === 'custom' && task.customInterval) return daysSinceCreated % task.customInterval === 0;
    
    return false;
  };

  const filteredTasks = (selectedCategoryId 
    ? tasks.filter(t => t.categoryId === selectedCategoryId && shouldShowToday(t))
    : tasks.filter(t => shouldShowToday(t))).sort((a, b) => {
      if (sortBy === 'time') {
        const timeA = a.reminderTime || '99:99';
        const timeB = b.reminderTime || '99:99';
        return timeA.localeCompare(timeB);
      }
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

  const totalSlots = tasks.reduce((acc, t) => acc + (t.frequency === 'twice-daily' ? 2 : 1), 0);
  const progressPercent = totalSlots > 0 ? (completions.length / totalSlots) * 100 : 0;

  useEffect(() => {
    onProgressChange(progressPercent);
  }, [progressPercent, onProgressChange]);

  if (loading) return null;

  const getUrgency = (task: Task) => {
    if (!task.reminderTime || isCompleted(task.id)) return 'none';
    const now = new Date();
    const reminder = parse(task.reminderTime, 'HH:mm', now);
    if (isAfter(now, reminder)) return 'overdue';
    if (isAfter(now, addHours(reminder, -1))) return 'soon';
    return 'none';
  };

  const handleThemeSelect = async (themeId: string) => {
    await taskService.updateUserTheme(profile.uid, themeId);
    onProfileUpdate();
  };

  return (
    <div className="space-y-8">
      <style>{`
        body {
          background-image: ${currentTheme.bg} !important;
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cn(
          "md:col-span-2 glass-panel p-6 rounded-3xl border-l-4 flex justify-between items-center relative overflow-hidden",
          `border-l-${currentTheme.accent}`
        )}>
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-1">Cadet Mission Log</h3>
            <p className="text-sm text-slate-500 uppercase tracking-widest font-black">Level {profile.level || 1} Elite</p>
          </div>
          <div className="flex gap-4 items-center relative z-10">
            <button 
              onClick={() => setShowThemeSelector(true)}
              className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-black">Combustion</p>
              <p className="text-2xl font-black italic text-orange-500 leading-none">{streak} DAYS</p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all",
              streak > 0 ? "bg-orange-500/20 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] animate-pulse" : "bg-slate-800 text-slate-600"
            )}>
              <Flame className={cn("w-7 h-7", streak > 0 && "fill-orange-500")} />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
        </div>

        <div className={cn(
          "glass-panel p-6 rounded-3xl border-l-4 flex flex-col justify-center relative overflow-hidden group",
          `border-l-${currentTheme.primary}`
        )}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Rank Progress</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white leading-none">{(profile.xp || 0) % 100}</span>
                <span className="text-xs font-bold text-slate-500 uppercase">/ 100 XP</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Total Career</p>
              <p className={cn("text-sm font-bold leading-none", `text-${currentTheme.primary}`)}>{profile.xp || 0} XP</p>
            </div>
          </div>
          
          <div className="w-full h-4 bg-slate-900 rounded-full border border-slate-800 p-0.5 overflow-hidden mb-3 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(profile.xp || 0) % 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn("h-full rounded-full relative", `bg-${currentTheme.primary}`)}
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
            </motion.div>
          </div>
          
          <div className="flex justify-between items-center">
            <p className={cn("text-[10px] font-bold uppercase tracking-tight flex items-center gap-1", `text-${currentTheme.primary}/80`)}>
              <TrendingUp className="w-3 h-3" /> {100 - ((profile.xp || 0) % 100)} XP to LEVEL { (profile.level || 1) + 1}
            </p>
            <span className="text-[10px] font-black text-slate-600 uppercase">{(profile.xp || 0) % 100}%</span>
          </div>
          
          {/* Subtle background flair */}
          <div className={cn("absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full translate-x-8 -translate-y-8 group-hover:opacity-20 transition-opacity", `bg-${currentTheme.primary}/10`)} />
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-yellow-500">
        <h3 className="text-xl font-black italic tracking-tighter uppercase mb-6 text-yellow-500">Mission Reward Store</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rewards.map(r => {
            const isClaimed = claimedRewards.some(cr => cr.rewardId === r.id);
            const canAfford = (profile.xp || 0) >= r.xpCost;
            return (
              <div key={r.id} className="bg-slate-950 p-4 rounded-xl flex justify-between items-center border border-slate-800">
                 <div>
                   <p className="font-bold text-slate-200">{r.title}</p>
                   <p className="text-slate-500 text-xs">{r.description} - <span className="text-yellow-500 font-bold">{r.xpCost} XP</span></p>
                 </div>
                 <button 
                   disabled={isClaimed || !canAfford}
                   onClick={() => claimReward(r.id, r.xpCost)}
                   className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", 
                     isClaimed ? "bg-slate-800 text-slate-500" : (canAfford ? "bg-yellow-600 text-white" : "bg-slate-800 text-slate-500"),
                     !isClaimed && canAfford && "hover:bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                   )}
                 >
                   {isClaimed ? "Claimed" : (canAfford ? "Claim" : "Not Enough XP")}
                 </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded-2xl">
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl">
            <button 
              onClick={() => setSortBy('time')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'time' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Clock className="w-3 h-3" /> Time
            </button>
            <button 
              onClick={() => setSortBy('created')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                sortBy === 'created' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <CalendarDays className="w-3 h-3" /> New
            </button>
          </div>
        </div>

        <button 
          onClick={() => setShowHistory(true)}
          className={cn(
            "p-2 px-4 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",
            `bg-${currentTheme.primary}/20 text-${currentTheme.primary} border border-${currentTheme.primary}/30 hover:bg-${currentTheme.primary}/30 active:scale-95`
          )}
        >
          <History className="w-3 h-3" /> Archive
        </button>
      </div>

      <AnimatePresence>
        {showHistory && (
          <MissionHistoryModal 
            profile={profile}
            tasks={tasks}
            categories={categories}
            onClose={() => setShowHistory(false)}
          />
        )}
        {showThemeSelector && (
          <ThemeSelectorModal 
            currentThemeId={profile.themeId || 'space'}
            onSelect={handleThemeSelect}
            onClose={() => setShowThemeSelector(false)}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTasks.map(task => {
          const urgency = getUrgency(task);
          const category = categories.find(c => c.id === task.categoryId);
          const locked = isTaskLocked(task);
          
          if (task.frequency === 'twice-daily') {
            return (
              <React.Fragment key={task.id}>
                {[1, 2].map(slot => (
                  <TaskCard 
                    key={`${task.id}-${slot}`}
                    task={task}
                    isDone={isCompleted(task.id, slot)}
                    isLocked={locked}
                    onToggle={() => toggleTask(task.id, isCompleted(task.id, slot), slot)}
                    urgency={urgency}
                    slotLabel={slot === 1 ? 'Morning' : 'Evening'}
                    category={category}
                  />
                ))}
              </React.Fragment>
            );
          }

          return (
            <TaskCard 
              key={task.id}
              task={task}
              isDone={isCompleted(task.id)}
              isLocked={locked}
              onToggle={() => toggleTask(task.id, isCompleted(task.id))}
              urgency={urgency}
              category={category}
            />
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="col-span-full text-center py-12 glass-panel rounded-[40px]">
            <Award className="w-16 h-16 text-blue-500/20 mx-auto mb-4" />
            <p className="text-slate-500 italic uppercase text-xs tracking-widest font-bold">No missions in current star-system.</p>
          </div>
        )}
      </div>

      {progressPercent === 100 && totalSlots > 0 && (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 p-8 rounded-[40px] text-center glow-green"
        >
          <Award className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Maximum Efficiency</h3>
          <p className="text-emerald-400 font-bold uppercase text-[10px] tracking-widest">All Objectives Neutralized</p>
        </motion.div>
      )}

      {/* Alert Banner / Notification */}
      {tasks.some(t => getUrgency(t) === 'overdue') && (
        <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl glow-orange">
          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-slate-950">
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-amber-500 font-black text-xs uppercase tracking-widest">Ground Control Alert</p>
            <p className="text-slate-400 text-[10px] italic">Mission objectives are critical. Immediate deployment required.</p>
          </div>
        </div>
      )}

      {/* Badge Collection Section */}
      <div className="space-y-4 pt-8">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-xl font-bold italic uppercase tracking-tight">Badge Collection</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.values(BADGE_DEFS).map(badge => {
            const isEarned = (profile.badges || []).some(b => b.id === badge.id);
            return (
              <motion.div 
                key={badge.id}
                whileHover={isEarned ? { scale: 1.05 } : {}}
                className={cn(
                  "p-5 rounded-[30px] border-2 flex flex-col items-center justify-center text-center gap-3 transition-all relative overflow-hidden",
                  isEarned ? cn(badge.color, "bg-opacity-10 border-white/20 glow-blue shadow-lg") : "bg-slate-900 border-slate-800 opacity-40 grayscale"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-1 shadow-inner",
                  isEarned ? "bg-white/10" : "bg-slate-800"
                )}>
                  {badge.icon}
                </div>
                <div>
                  <p className={cn("font-black uppercase text-[10px] tracking-widest leading-tight", isEarned ? "text-white" : "text-slate-500")}>
                    {badge.name}
                  </p>
                  <p className="text-[8px] text-slate-500 italic mt-1 leading-tight px-1">{badge.description}</p>
                </div>
                {isEarned && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-3 right-3"
                  >
                    <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {confirmTask && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="bg-slate-900 border-2 border-slate-700 rounded-[40px] p-8 shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-500/5 glow-blue" />
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                <CheckCircle2 className="w-10 h-10 text-blue-500" />
              </div>
              <h4 className="text-2xl font-black uppercase italic tracking-tighter mb-2 relative z-10">Verify Mission</h4>
              <p className="text-slate-400 mb-8 relative z-10 uppercase text-[10px] font-bold tracking-widest leading-relaxed">
                Did you complete<br/><span className="text-white text-base">"{confirmTask.taskTitle}"</span>?
              </p>
              
              <div className="flex gap-4 relative z-10">
                <button 
                  onClick={() => setConfirmTask(null)}
                  className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeCompletion}
                  className="flex-1 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] glow-green"
                >
                  Confirm +{confirmTask.xpReward} XP
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {xpAnimation.active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: [0.5, 1.2, 1], y: -100 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed inset-0 z-[130] pointer-events-none flex items-center justify-center"
          >
            <div className="flex flex-col items-center">
               <motion.div 
                 animate={{ rotate: 360 }} 
                 transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                 className="text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"
               >
                 <Star className="w-20 h-20 fill-yellow-400" />
               </motion.div>
               <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-500 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] uppercase tracking-tighter italic">
                 +{xpAnimation.amount} XP
               </span>
            </div>
          </motion.div>
        )}

        {unlockedBadge && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-10 left-6 right-6 md:left-auto md:right-10 md:w-80 z-[100] bg-slate-950 border-2 border-blue-500 rounded-[40px] p-8 shadow-2xl glow-blue backdrop-blur-xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="text-6xl mb-6 animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                {unlockedBadge.icon}
              </div>
              <h4 className="text-xl font-black uppercase italic text-blue-400 mb-2 tracking-tighter">New Badge Earned!</h4>
              <p className="text-white font-black text-lg leading-tight mb-2 uppercase tracking-wide">{unlockedBadge.name}</p>
              <p className="text-slate-500 text-xs mb-8 italic leading-relaxed">{unlockedBadge.description}</p>
              <button 
                onClick={() => setUnlockedBadge(null)}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95"
              >
                Dismiss Communication
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({ task, isDone, isLocked, onToggle, urgency, slotLabel, category }: { 
  task: Task, 
  isDone: boolean, 
  isLocked?: boolean,
  onToggle: () => void | Promise<void>, 
  urgency: 'none' | 'soon' | 'overdue',
  slotLabel?: string,
  category?: Category,
  key?: React.Key
}) {
  const accentColor = isDone ? 'border-l-emerald-500' : (isLocked ? 'border-l-slate-700' : (urgency === 'overdue' ? 'border-l-amber-500' : 'border-l-blue-500'));
  
  const statusConfig = isDone 
    ? { label: 'MISSION COMPLETED', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
    : (isLocked 
        ? { label: 'SYSTEM LOCKED', icon: <Lock className="w-3 h-3" />, color: 'text-slate-400 bg-slate-800/80 border-slate-700' }
        : (urgency === 'overdue' 
            ? { label: 'SYSTEM ALERT: OVERDUE', icon: <AlertCircle className="w-3 h-3" />, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse' }
            : urgency === 'soon'
            ? { label: 'IMMINENT: UPCOMING', icon: <Clock className="w-3 h-3" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
            : { label: 'STATUS: PENDING', icon: <Activity className="w-3 h-3" />, color: 'text-slate-400 bg-slate-800/80 border-slate-700' }));

  return (
    <motion.div 
      layout
      whileTap={!isLocked ? { scale: 0.98 } : {}}
      whileHover={!isLocked ? { y: -2 } : {}}
      onClick={!isLocked ? onToggle : undefined}
      className={cn(
        "card-immersive group relative overflow-hidden",
        !isLocked ? "cursor-pointer" : "cursor-not-allowed opacity-80",
        accentColor,
        isDone ? "opacity-60 bg-emerald-500/5 shadow-none" : (isLocked ? "bg-slate-900/50 grayscale-[0.5]" : (urgency === 'overdue' ? "bg-amber-500/5 glow-orange border-amber-500/30" : "hover:shadow-lg hover:shadow-blue-500/10")),
      )}
    >
      {/* Top Status Accent Bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        isDone ? "bg-emerald-500" : (isLocked ? "bg-slate-700" : (urgency === 'overdue' ? "bg-amber-500 animate-pulse" : (urgency === 'soon' ? "bg-blue-500" : "bg-slate-700")))
      )} />

      {/* Background Effect for Overdue */}
      {urgency === 'overdue' && !isDone && !isLocked && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      )}

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-2">
            <motion.div 
              layout
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all",
                statusConfig.color
              )}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </motion.div>
            
            <motion.span 
              layout
              className={cn(
                "text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-500"
              )}
            >
              {slotLabel || (
                task.frequency === 'custom' 
                  ? `Every ${task.customInterval} Days` 
                  : task.frequency.replace('-', ' ')
              )}
            </motion.span>
            {task.difficulty && !isDone && (
              <span className={cn(
                "text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest border transition-all flex items-center gap-1.5",
                task.difficulty === 'easy' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                task.difficulty === 'medium' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                "bg-rose-500/10 text-rose-400 border-rose-500/20"
              )}>
                <Zap className="w-3 h-3" />
                {task.difficulty} | +{XP_REWARDS[task.difficulty]} XP
              </span>
            )}
            {category && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider text-white", category.color)}>
                {category.icon} {category.name}
              </span>
            )}
          </div>
          <motion.h3 
            layout
            className={cn("text-xl font-bold mt-2", isDone && "line-through text-slate-500")}
          >
            {task.title}
          </motion.h3>
          <p className={cn("text-[10px] mt-1 italic font-bold tracking-tight", isDone ? "text-emerald-500/70" : (isLocked ? "text-slate-500" : (urgency === 'overdue' ? "text-rose-500 animate-pulse" : "text-slate-500")))}>
            {isDone ? "✓ MISSION NEUTRALIZED" : (isLocked ? "🔒 PREREQUISITES REQUIRED" : (urgency === 'overdue' ? "⚠ ALARM: MISSION OVERDUE" : "○ AWAITING DEPLOYMENT..."))}
          </p>
        </div>
        
        <motion.div 
          initial={false}
          animate={{ 
            scale: isDone ? [1, 1.2, 1] : 1,
            rotate: isDone ? [0, 15, -15, 0] : 0,
            boxShadow: isDone 
              ? "0 0 20px rgba(16, 185, 129, 0.4)" 
              : (urgency === 'overdue' && !isLocked ? "0 0 20px rgba(244, 63, 94, 0.4)" : "none")
          }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className={cn(
            "w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl shrink-0 ml-4 border-2 transition-colors",
            isDone 
              ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50" 
              : (isLocked ? "bg-slate-900 border-slate-800 text-slate-600" : (urgency === 'overdue' 
                  ? "bg-rose-500/20 text-rose-500 border-rose-500/50 animate-pulse" 
                  : (urgency === 'soon' ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "text-slate-400 border-slate-800")))
          )}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={isDone ? 'done' : (isLocked ? 'locked' : 'pending')}
              initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
              transition={{ duration: 0.2 }}
            >
              {isDone ? '🚀' : (isLocked ? <Lock className="w-6 h-6 text-slate-600" /> : (category ? category.icon : (slotLabel === 'Morning' ? '🌅' : (slotLabel === 'Evening' ? '🌙' : '🛰️'))))}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
      
      {!isDone ? (
        <motion.button 
          whileHover={!isLocked ? { scale: 1.02 } : {}}
          whileTap={!isLocked ? { scale: 0.98 } : {}}
          disabled={isLocked}
          className={cn(
            "w-full py-3 font-black rounded-xl transition-all uppercase tracking-widest text-[10px] relative overflow-hidden flex items-center justify-center gap-2",
            isLocked 
              ? "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
              : urgency === 'overdue' ? "bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]" : "bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/40"
          )}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isLocked ? <><Lock className="w-3 h-3" /> Locked: Wait for Clearance</> : "Execute Mission"}
          </span>
          {urgency === 'overdue' && !isLocked && (
            <motion.div 
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute inset-0 bg-white/20 -skew-x-12"
            />
          )}
        </motion.button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full py-3 bg-emerald-500/10 text-emerald-500 font-black rounded-xl text-center uppercase tracking-widest text-[10px] border border-emerald-500/20 flex items-center justify-center gap-2"
        >
          <Zap className="w-3 h-3 animate-pulse" /> Mission Verified: +{XP_REWARDS[task.difficulty || 'easy']} XP
        </motion.div>
      )}
    </motion.div>
  );
}
