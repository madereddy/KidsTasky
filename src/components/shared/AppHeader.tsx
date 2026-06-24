import { Activity, Lock, LogOut, Rocket, Settings, User as UserIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AppSection } from '../../hooks/useSectionNavigation';
import type { AppUser, UserProfile } from '../../types';

type ThemeLike = {
  primary: string;
  accent: string;
  vocab?: {
    darkMode?: boolean;
    panelBg?: string;
    panelBorder?: string;
    textPrimary?: string;
    hub?: string;
  };
};

type ParentSession = {
  token: string;
  user: AppUser;
  profile: UserProfile;
};

type AppHeaderProps = {
  profile: UserProfile;
  kids: UserProfile[];
  currentTheme: ThemeLike;
  activeSection: string;
  isDarkTheme: boolean;
  isLocked: boolean;
  isOffline: boolean;
  syncing: boolean;
  isMobile: boolean;
  showProfileSwitcher: boolean;
  parentSession: ParentSession | null;
  onSectionSelect: (section: AppSection) => void;
  onSettingsSelect: () => void;
  onUnlockSelect: () => void;
  onProfileSwitcherToggle: () => void;
  onKidSwitchSelect: (kid: UserProfile) => void;
  onParentSwitchSelect: () => void;
  onLogout: () => Promise<void>;
};

const PARENT_SECTIONS: AppSection[] = ['home', 'tasks', 'calendar', 'shopping', 'routines', 'meals'];

const isParentRole = (role?: UserProfile['role']) => role === 'parent' || role === 'coparent';

export function AppHeader({
  profile,
  kids,
  currentTheme,
  activeSection,
  isDarkTheme,
  isLocked,
  isOffline,
  syncing,
  isMobile,
  showProfileSwitcher,
  parentSession,
  onSectionSelect,
  onSettingsSelect,
  onUnlockSelect,
  onProfileSwitcherToggle,
  onKidSwitchSelect,
  onParentSwitchSelect,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-[60] backdrop-blur-xl border-b px-4 py-2 mb-2 md:mx-4 md:mt-4 md:rounded-[2rem] md:px-6 md:py-3 md:mb-8 md:shadow-sm", currentTheme.vocab?.panelBg || "bg-white/80", currentTheme.vocab?.panelBorder || "border-ui")}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl bg-gradient-to-br", `from-${currentTheme.primary} to-${currentTheme.accent}`, "shadow-sm")}>
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <h1 className={cn("text-xl font-bold tracking-tight hidden sm:block", currentTheme.vocab?.textPrimary || "text-ui-primary")}>
              {isParentRole(profile.role) ? 'Family Hub' : currentTheme.vocab?.hub || 'My Chores'}
            </h1>
            {isOffline ? <div className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full animate-pulse ml-2 whitespace-nowrap"><span>☁️ Offline</span></div> : null}
            {syncing ? <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full ml-2 whitespace-nowrap"><Activity className="w-3 h-3 animate-spin" /><span>Syncing...</span></div> : null}
          </div>
          {isParentRole(profile.role) ? (
            <nav className={cn("hidden md:flex gap-1 p-1 rounded-2xl", isDarkTheme ? "bg-ui-dark-50" : "bg-ui-soft-2")}>
              {PARENT_SECTIONS.map(sec => (
                <button
                  key={sec}
                  onClick={() => onSectionSelect(sec)}
                  className={cn("px-4 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-semibold transition-all", activeSection === sec ? cn(`bg-${currentTheme.primary} text-white shadow-sm`) : (isDarkTheme ? "text-ui-secondary hover:text-white" : "text-ui-muted hover:text-ui-primary"))}
                >
                  {sec.charAt(0).toUpperCase() + sec.slice(1)}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {isParentRole(profile.role) ? (
            <button aria-label={isLocked ? "Unlock display" : "Open settings"} onClick={isLocked ? onUnlockSelect : onSettingsSelect} className={cn("p-2 min-w-[44px] min-h-[44px] justify-center rounded-xl border transition-colors flex items-center gap-2 z-[61]", isLocked ? (isDarkTheme ? "text-amber-200 border-amber-400/50 bg-amber-500/10" : "text-amber-900 border-amber-300 bg-amber-50") : (isDarkTheme ? "text-ui-secondary border-ui-dark-3 hover:text-white" : "text-ui-muted-2 border-ui hover:text-ui-primary hover:bg-ui-soft"))}>
              {isLocked ? <Lock className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
            </button>
          ) : null}
          <div className="relative">
            <button aria-label="Switch profile" onClick={onProfileSwitcherToggle} className="w-11 h-11 bg-ui-soft-2 border border-ui rounded-full flex items-center justify-center text-ui-muted-2 hover:text-sky-500 transition-colors"><UserIcon className="w-5 h-5" /></button>
            {showProfileSwitcher && !isMobile ? (
              <div className={cn("absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl z-50 p-2", isDarkTheme ? "bg-ui-deep border-ui-dark" : "bg-white border-ui")}>
                {kids.filter(k => k.uid !== profile.uid).map(k => (
                  <button key={k.uid} onClick={() => onKidSwitchSelect(k)} className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-ui-soft", isDarkTheme && "hover:bg-ui-dark-2")}>
                    {k.name} <span className="text-xs text-ui-muted">Kid</span>
                  </button>
                ))}
                {parentSession && profile.role === 'kid' ? (
                  <button onClick={onParentSwitchSelect} className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-semibold hover:bg-ui-soft", isDarkTheme && "hover:bg-ui-dark-2")}>
                    {parentSession.profile.name} <span className="text-xs text-ui-muted">Parent</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <button aria-label="Log out" onClick={() => void onLogout()} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-ui-muted-2 hover:text-rose-500 transition-colors hover:bg-rose-50 rounded-full"><LogOut className="w-5 h-5" /></button>
        </div>
      </div>
    </header>
  );
}
