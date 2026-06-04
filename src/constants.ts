import { BadgeDef, TaskDifficulty } from './types';

export const CATEGORY_ICONS = ['🏠', '🏫', '🥦', '🎨', '🎮', '🧹', '🐶', '🌟', '💧', '📚', '🏃', '🌙', '☀️'];

export const CATEGORY_COLORS = [
  { name: 'Blue', class: 'bg-blue-500', text: 'text-blue-500' },
  { name: 'Purple', class: 'bg-purple-500', text: 'text-purple-500' },
  { name: 'Emerald', class: 'bg-emerald-500', text: 'text-emerald-500' },
  { name: 'Rose', class: 'bg-rose-500', text: 'text-rose-500' },
  { name: 'Amber', class: 'bg-amber-500', text: 'text-amber-500' },
  { name: 'Slate', class: 'bg-slate-500', text: 'text-slate-500' },
  { name: 'Cyan', class: 'bg-cyan-500', text: 'text-cyan-500' },
];

export const MEMBER_COLORS = [
  '#6366f1',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#f97316',
  '#06b6d4',
  '#ec4899',
];

export const XP_REWARDS: Record<TaskDifficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 50
};

export const BADGE_DEFS: Record<string, BadgeDef> = {
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

export const THEMES = [
  { 
    id: 'space_commander', 
    name: 'Space Commander', 
    icon: '🚀', 
    primary: 'blue-500', 
    accent: 'purple-500', 
    bg: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #05070a 100%)',
    border: 'border-blue-500/20',
    vocab: {
      hub: 'Sector Command',
      chores: 'Mission Log',
      level: 'Rank',
      streak: 'Combustion',
      points: 'Credits',
      allDone: 'Maximum Efficiency',
      allDoneDesc: 'All Objectives Neutralized',
      overdue: 'Ground Control Alert',
      overdueDesc: 'Missions are critical. Immediate deployment required.',
      badges: 'Commendations',
      rewards: 'Requisition Store',
      noTasks: 'No missions in current star system.',
      verifyTitle: 'Verify Mission',
      verifyDesc: 'Did you execute',
      confirmYes: 'Confirm',
      markDone: 'Execute Mission',
      locked: 'Prerequisites Required',
      completed: 'Mission Verified',
      darkMode: true,
      textPrimary: 'text-white',
      textSecondary: 'text-slate-400',
      panelBg: 'bg-slate-900/50 backdrop-blur-md',
      panelBorder: 'border-slate-800'
    }
  },
  { 
    id: 'fantasy_knight', 
    name: 'Dragon Knight', 
    icon: '⚔️', 
    primary: 'amber-500', 
    accent: 'red-600', 
    bg: 'radial-gradient(circle at 50% 50%, #291204 0%, #0a0501 100%)',
    border: 'border-amber-500/20',
    vocab: {
      hub: 'The Round Table',
      chores: 'Quest Board',
      level: 'Level',
      streak: 'Glory',
      points: 'Gold',
      allDone: 'Kingdom Safe',
      allDoneDesc: 'All beasts vanquished today',
      overdue: 'To Arms!',
      overdueDesc: 'The realm needs your aid immediately.',
      badges: 'Artifacts',
      rewards: 'Merchant',
      noTasks: 'Peace reigns in the kingdom today.',
      verifyTitle: 'Quest Complete?',
      verifyDesc: 'Did you vanquish',
      confirmYes: 'Huzzah!',
      markDone: 'Complete Quest',
      locked: 'Sealed Quest',
      completed: 'Quest Turned In',
      darkMode: true,
      textPrimary: 'text-amber-50',
      textSecondary: 'text-amber-200/60',
      panelBg: 'bg-[#1a0a00]/80 backdrop-blur-md',
      panelBorder: 'border-amber-900/50'
    }
  },
  {
    id: 'family_hub_light',
    name: 'Family Hub',
    icon: '🏡',
    primary: 'indigo-600',
    accent: 'sky-500',
    bg: '#f0f4ff',
    border: 'border-indigo-100',
    vocab: {
      hub: 'Family Hub',
      chores: 'My Chores',
      level: 'Level',
      streak: 'Streak',
      points: 'XP',
      allDone: 'All Done!',
      allDoneDesc: 'Great job today!',
      overdue: 'Chores Overdue',
      overdueDesc: 'Some chores need your attention.',
      badges: 'My Badges',
      rewards: 'Rewards',
      noTasks: "No chores right now. All caught up!",
      verifyTitle: 'All Done?',
      verifyDesc: 'Did you complete',
      confirmYes: 'Yes!',
      markDone: 'Mark Done',
      locked: 'Locked',
      completed: 'Completed!',
      darkMode: false,
      textPrimary: 'text-slate-900',
      textSecondary: 'text-slate-500',
      panelBg: 'bg-white shadow-sm',
      panelBorder: 'border-slate-200'
    }
  },
  {
    id: 'light_blue',
    name: 'Sky Blue Helper', 
    icon: '🌤️', 
    primary: 'sky-500', 
    accent: 'blue-500', 
    bg: '#f8fafc',
    border: 'border-slate-200',
    vocab: {
      hub: 'Family Hub',
      chores: 'My Chores',
      level: 'Level',
      streak: 'Streak',
      points: 'XP',
      allDone: 'All Done!',
      allDoneDesc: 'Great job today!',
      overdue: 'Chores Overdue',
      overdueDesc: 'Some chores need your attention right now.',
      badges: 'My Badges',
      rewards: 'Rewards',
      noTasks: "No chores right now. You're all caught up!",
      verifyTitle: 'All Done?',
      verifyDesc: 'Did you complete',
      confirmYes: 'Yes!',
      markDone: 'Mark Done',
      locked: 'Locked',
      completed: 'Completed!',
      darkMode: false,
      textPrimary: 'text-slate-900',
      textSecondary: 'text-slate-500',
      panelBg: 'bg-white shadow-sm',
      panelBorder: 'border-slate-100'
    }
  },
  { 
    id: 'light_green', 
    name: 'Mint Green Helper', 
    icon: '🌿', 
    primary: 'emerald-500', 
    accent: 'teal-500', 
    bg: '#ecfdf5',
    border: 'border-emerald-100',
    vocab: {
      hub: 'Family Hub',
      chores: 'My Chores',
      level: 'Level',
      streak: 'Streak',
      points: 'XP',
      allDone: 'All Done!',
      allDoneDesc: 'Great job today!',
      overdue: 'Chores Overdue',
      overdueDesc: 'Some chores need your attention right now.',
      badges: 'My Badges',
      rewards: 'Rewards',
      noTasks: "No chores right now. You're all caught up!",
      verifyTitle: 'All Done?',
      verifyDesc: 'Did you complete',
      confirmYes: 'Yes!',
      markDone: 'Mark Done',
      locked: 'Locked',
      completed: 'Completed!',
      darkMode: false,
      textPrimary: 'text-slate-900',
      textSecondary: 'text-slate-500',
      panelBg: 'bg-white shadow-sm',
      panelBorder: 'border-slate-100'
    }
  },
  { 
    id: 'light_rose', 
    name: 'Rose Pink Helper', 
    icon: '🌸', 
    primary: 'rose-400', 
    accent: 'pink-500', 
    bg: '#fff1f2',
    border: 'border-rose-100',
    vocab: {
      hub: 'Family Hub',
      chores: 'My Chores',
      level: 'Level',
      streak: 'Streak',
      points: 'XP',
      allDone: 'All Done!',
      allDoneDesc: 'Great job today!',
      overdue: 'Chores Overdue',
      overdueDesc: 'Some chores need your attention right now.',
      badges: 'My Badges',
      rewards: 'Rewards',
      noTasks: "No chores right now. You're all caught up!",
      verifyTitle: 'All Done?',
      verifyDesc: 'Did you complete',
      confirmYes: 'Yes!',
      markDone: 'Mark Done',
      locked: 'Locked',
      completed: 'Completed!',
      darkMode: false,
      textPrimary: 'text-slate-900',
      textSecondary: 'text-slate-500',
      panelBg: 'bg-white shadow-sm',
      panelBorder: 'border-slate-100'
    }
  }
];

export const WMO_WEATHER: Record<number, { icon: string; label: string }> = {
  0: { icon: "sun", label: "Clear" },
  1: { icon: "fair", label: "Mostly Clear" },
  2: { icon: "cloud-sun", label: "Partly Cloudy" },
  3: { icon: "cloud", label: "Overcast" },
  45: { icon: "fog", label: "Fog" },
  48: { icon: "fog", label: "Icy Fog" },
  51: { icon: "drizzle", label: "Light Drizzle" },
  53: { icon: "drizzle", label: "Drizzle" },
  55: { icon: "rain", label: "Heavy Drizzle" },
  61: { icon: "rain", label: "Light Rain" },
  63: { icon: "rain", label: "Rain" },
  65: { icon: "rain", label: "Heavy Rain" },
  71: { icon: "snow", label: "Light Snow" },
  73: { icon: "snow", label: "Snow" },
  75: { icon: "snow", label: "Heavy Snow" },
  80: { icon: "showers", label: "Showers" },
  81: { icon: "showers", label: "Rain Showers" },
  82: { icon: "storm", label: "Violent Showers" },
  85: { icon: "snow", label: "Snow Showers" },
  95: { icon: "storm", label: "Thunderstorm" },
  99: { icon: "storm", label: "Thunderstorm with Hail" }
};

export function getWeatherInfo(code: number): { icon: string; label: string } {
  return WMO_WEATHER[code] ?? { icon: "weather", label: "Weather" };
}
