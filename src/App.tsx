import React, { useState, useEffect } from 'react';
import { LogOut, Rocket, User as UserIcon, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Category } from './types';
import { taskService } from './services/taskService';
import { cn } from './lib/utils';
import { THEMES } from './constants';

import { LoginView } from './components/LoginView';
import { OnboardingView } from './components/OnboardingView';
import { ParentDashboard } from './components/ParentDashboard';
import { KidDashboard } from './components/KidDashboard';

interface AppUser {
  uid: string;
  email?: string;
  name: string;
  displayName?: string;
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const storedUid = localStorage.getItem('kidtasker_uid');
      if (storedUid) {
        const u = await taskService.getMe(storedUid);
        if (u) {
          setUser({ uid: u.uid, name: u.name, email: u.email });
          setProfile(u);
          const parentId = u.role === 'parent' ? u.uid : u.parentId;
          if (parentId) {
            const cats = await taskService.getCategories(parentId);
            setCategories(cats || []);
          }
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kidtasker_uid');
    setUser(null);
    setProfile(null);
  };

  const handleProfileUpdate = async () => {
    if (user) {
      const p = await taskService.getUserProfile(user.uid);
      setProfile(p);
    }
  };

  const currentThemeId = profile?.themeId || 'space';
  const currentTheme = THEMES.find(t => t.id === currentThemeId) || THEMES[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen animate-gradient text-white selection:bg-blue-500/30 overflow-x-hidden">
        <LoginView onLogin={async (username: string) => {
          const u = await taskService.signIn(username);
          if (u) {
             setUser({ uid: u.uid, name: u.name, email: u.email });
             localStorage.setItem('kidtasker_uid', u.uid);
             if (u.role) setProfile(u);
          }
        }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
        <OnboardingView 
          user={{ uid: user.uid, email: user.email, name: user.name }} 
          onComplete={async (p: UserProfile) => {
            setProfile(p);
            const parentId = p.role === 'parent' ? p.uid : p.parentId;
            if (parentId) {
              const cats = await taskService.getCategories(parentId);
              setCategories(cats || []);
            }
          }} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white selection:bg-blue-500/30 overflow-x-hidden pb-12 transition-colors duration-500" style={{ background: currentTheme.bg }}>
      <header className="glass-panel sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 mx-6 mt-6 rounded-[2rem] px-8 py-4 mb-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl bg-gradient-to-br", `from-${currentTheme.primary} to-${currentTheme.accent}`, "shadow-lg shadow-blue-500/20")}>
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase hidden sm:block">Sector {profile.role === 'parent' ? '7' : 'Command'}</h1>
            </div>
            
            <div className="h-10 w-[1px] bg-white/10 hidden sm:block" />
            
            <nav className="hidden md:flex gap-1 bg-slate-950/50 p-1 rounded-2xl">
               <button 
                 onClick={() => setSelectedCategoryId(null)}
                 className={cn(
                   "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                   !selectedCategoryId ? cn(`bg-${currentTheme.primary} text-white shadow-lg shadow-blue-500/20`) : "text-slate-500 hover:text-white"
                 )}
               >
                 All Systems
               </button>
               {categories.map(cat => (
                 <button 
                   key={cat.id}
                   onClick={() => setSelectedCategoryId(cat.id)}
                   className={cn(
                     "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center",
                     selectedCategoryId === cat.id ? cn(cat.color, "text-white shadow-lg") : "text-slate-500 hover:text-white"
                   )}
                 >
                   <span>{cat.icon}</span>
                   <span className="hidden lg:inline">{cat.name}</span>
                 </button>
               ))}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black leading-none mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-tight">Active</span>
                </div>
              </div>
              <div className="relative group">
                <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors cursor-pointer group-hover:border-blue-500/50">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-950" />
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-rose-500 transition-colors hover:bg-rose-500/5 rounded-xl"
              title="Terminate Session"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Progress Line (Top Decoration) */}
        {profile.role === 'kid' && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900/50 px-8">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn("h-full bg-gradient-to-r transition-all", `from-${currentTheme.primary} to-${currentTheme.accent}`)}
            />
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6">
        <AnimatePresence mode="wait">
          {profile.role === 'parent' ? (
            <motion.div
              key="parent-dash"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ParentDashboard 
                profile={profile} 
                categories={categories}
                onCategoriesChange={setCategories}
                selectedCategoryId={selectedCategoryId}
              />
            </motion.div>
          ) : (
            <motion.div
              key="kid-dash"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <KidDashboard 
                profile={profile} 
                onProgressChange={setProgress} 
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onProfileUpdate={handleProfileUpdate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 pt-10 border-t border-white/5 mx-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
              <Activity className="w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">System Signal: 🛰️ OK_CONNECTED</p>
          </div>
          <div className="flex gap-8">
            <p className="text-[9px] text-slate-700 uppercase font-black tracking-widest">Protocol v4.0.2</p>
            <p className="text-[9px] text-slate-700 uppercase font-black tracking-widest">Secure Sector</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
