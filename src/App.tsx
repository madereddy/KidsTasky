import { authService } from './services/auth';
import { userService } from './services/users';
import { categoryService } from './services/categories';
import React, { useState, useEffect, useMemo } from 'react';
import { LogOut, Rocket, User as UserIcon, Activity, CalendarDays, List, UtensilsCrossed } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Category } from './types';
import { cn } from './lib/utils';
import { THEMES, MEMBER_COLORS } from './constants';
import { initSocket } from './hooks/useSocket';

import { LoginView } from './components/auth/LoginView';
import { OnboardingView } from './components/onboarding/OnboardingView';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { KidDashboard } from './components/kid/KidDashboard';
import { CalendarView } from './components/calendar/CalendarView';
import { ListsView } from './components/lists/ListsView';
import { MealPlanView } from './components/parent/MealPlanView';

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
  const [activeSection, setActiveSection] = useState<'tasks' | 'calendar' | 'lists' | 'meals'>('tasks');
  const [kids, setKids] = useState<UserProfile[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('kidtasker_token');
      if (storedToken) {
        try {
          const u = await authService.getMe(storedToken);
          if (u) {
            setUser({ uid: u.uid, name: u.name, email: u.email });
            setProfile(u);
            const parentId = u.role === 'parent' ? u.uid : u.parentId;
            if (parentId) {
              initSocket(parentId);
              const cats = await categoryService.getCategories(parentId);
              setCategories(cats || []);
              if (u.role === 'parent') {
                const k = await userService.getKidsForParent(parentId);
                setKids(k || []);
              }
            }
          } else {
            localStorage.removeItem('kidtasker_token');
          }
        } catch (e) {
          console.error("Auth initialization failed (network or server error)", e);
          // Do not log the user out (leave token intact) and possibly show a retry logic later.
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kidtasker_token');
    setUser(null);
    setProfile(null);
  };

  const handleProfileUpdate = async () => {
    if (user) {
      const p = await userService.getUserProfile(user.uid);
      setProfile(p);
    }
  };

  const memberColorMap = useMemo(() => {
    if (!profile) return {};
    return [profile, ...kids].reduce((acc, u) => {
      acc[u.uid] = u.color ?? MEMBER_COLORS[0];
      return acc;
    }, {} as Record<string, string>);
  }, [profile, kids]);

  const currentThemeId = profile?.themeId || 'space';
  const currentTheme = THEMES.find(t => t.id === currentThemeId) || THEMES[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-sky-500/30 overflow-x-hidden">
        <LoginView 
          onLogin={async (email: string, passwordString: string, isRegister: boolean, name?: string) => {
            const res = isRegister ? await authService.register(email, passwordString, name || '') : await authService.signIn(email, passwordString);
            if (res) {
              const { user: u, token } = res;
              setUser({ uid: u.uid, name: u.name, email: u.email });
              localStorage.setItem('kidtasker_token', token);
              if (u.role) setProfile(u);
              const parentId = u.role === 'parent' ? u.uid : u.parentId;
              if (parentId) initSocket(parentId);
            } else {
              alert('Invalid credentials or registration error');
            }
          }} 
          onKidLogin={async (uid: string, pin: string) => {
            const res = await authService.signInKid(uid, pin);
            if (res) {
              const { user: u, token } = res;
              setUser({ uid: u.uid, name: u.name, email: u.email });
              localStorage.setItem('kidtasker_token', token);
              if (u.role) setProfile(u);
              const parentId = u.role === 'parent' ? u.uid : u.parentId;
              if (parentId) initSocket(parentId);
            } else {
              alert('Invalid Access Key');
            }
          }}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-sky-500/30">
        <OnboardingView 
          user={{ uid: user.uid, email: user.email, name: user.name }} 
          onComplete={async (p: UserProfile) => {
            setProfile(p);
            const parentId = p.role === 'parent' ? p.uid : p.parentId;
            if (parentId) {
              initSocket(parentId);
              const cats = await categoryService.getCategories(parentId);
              setCategories(cats || []);
            }
          }} 
        />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen selection:bg-sky-500/30 overflow-x-hidden pb-12 transition-colors duration-500", currentTheme.vocab?.darkMode ? "text-white" : "text-slate-900")} style={{ background: currentTheme.bg }}>
      <header className={cn("sticky top-0 z-40 backdrop-blur-xl border-b mx-4 mt-4 rounded-[2rem] px-6 py-3 mb-8 shadow-sm", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-slate-200")}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl bg-gradient-to-br", `from-${currentTheme.primary} to-${currentTheme.accent}`, "shadow-sm")}>
                <Rocket className={cn("w-6 h-6", currentTheme.vocab?.darkMode ? "text-white" : "text-white")} />
              </div>
              <h1 className={cn("text-xl font-bold tracking-tight hidden sm:block", currentTheme.vocab?.textPrimary || "text-slate-800")}>
                {profile.role === 'parent' ? 'Family Hub' : currentTheme.vocab?.hub || 'My Chores'}
              </h1>
            </div>
            
            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />

            {profile?.role === 'parent' && (
              <nav className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-2xl">
                <button
                  onClick={() => setActiveSection('tasks')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                    activeSection === 'tasks' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Tasks
                </button>
                <button
                  onClick={() => setActiveSection('calendar')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'calendar' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <CalendarDays className="w-4 h-4" /> Calendar
                </button>
                <button
                  onClick={() => setActiveSection('lists')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'lists' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <List className="w-4 h-4" /> Lists
                </button>
                <button
                  onClick={() => setActiveSection('meals')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                    activeSection === 'meals' ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <UtensilsCrossed className="w-4 h-4" /> Meals
                </button>
              </nav>
            )}

            {profile?.role !== 'parent' && (
              <nav className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-2xl">
                 <button
                   onClick={() => setSelectedCategoryId(null)}
                   className={cn(
                     "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                     !selectedCategoryId ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : "text-slate-500 hover:text-slate-900"
                   )}
                 >
                   All
                 </button>
                 {categories.map(cat => (
                   <button
                     key={cat.id}
                     onClick={() => setSelectedCategoryId(cat.id)}
                     className={cn(
                       "px-4 py-2 rounded-xl text-sm font-semibold transition-all gap-2 flex items-center",
                       selectedCategoryId === cat.id ? cn(cat.color, "text-white shadow-sm") : "text-slate-500 hover:text-slate-900"
                     )}
                   >
                     <span>{cat.icon}</span>
                     <span className="hidden lg:inline">{cat.name}</span>
                   </button>
                 ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 group-hover:text-sky-500 transition-colors cursor-pointer">
                <UserIcon className="w-5 h-5" />
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors hover:bg-rose-50 rounded-full"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Progress Line (Top Decoration) */}
        {profile.role === 'kid' && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100 px-8 rounded-b-[2rem] overflow-hidden">
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
          {profile.role === 'parent' && activeSection === 'tasks' && (
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
          )}
          {profile.role === 'parent' && activeSection === 'calendar' && (
            <motion.div
              key="calendar-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <CalendarView parentId={profile.uid} kids={kids} memberColorMap={memberColorMap} />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'lists' && (
            <motion.div
              key="lists-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ListsView parentId={profile.uid} />
            </motion.div>
          )}
          {profile.role === 'parent' && activeSection === 'meals' && (
            <motion.div key="meals-view" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
              <MealPlanView parentId={profile.uid} />
            </motion.div>
          )}
          {profile.role !== 'parent' && (
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

      <footer className="mt-20 pt-10 border-t border-slate-200 mx-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-emerald-500">
              <Activity className="w-4 h-4" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Synced</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
