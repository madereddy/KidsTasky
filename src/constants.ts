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
