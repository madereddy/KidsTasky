export type UserRole = 'parent' | 'kid';

export interface UserProfile {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
  parentId?: string;
  xp?: number;
  level?: number;
  badges?: EarnedBadge[];
  themeId?: string;
}

export interface EarnedBadge {
  id: string;
  earnedAt: any;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export type TaskFrequency = 'daily' | 'twice-daily' | 'weekly' | 'bi-weekly' | 'custom';
export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  frequency: TaskFrequency;
  reminderTime?: string; // HH:mm
  assignedKidId: string;
  parentId: string;
  categoryId?: string;
  difficulty?: TaskDifficulty;
  status: 'active' | 'archived';
  createdAt: any; // Firestore Timestamp
  customInterval?: number; // Days for custom frequency
  prerequisiteTaskIds?: string[];
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  kidId: string;
  completedAt: any; // Firestore Timestamp
  dateString: string; // YYYY-MM-DD
  count?: number; // 1 or 2
}

export interface Invite {
  id: string; // The 6-digit code
  parentId: string;
  parentName: string;
  createdAt: any;
  status: 'active' | 'used' | 'expired';
}

export interface Notification {
  id: string;
  parentId: string;
  kidId: string;
  taskId: string;
  taskTitle: string;
  kidName: string;
  type: 'overdue';
  status: 'unread' | 'read';
  createdAt: any;
  dateString: string; // To avoid multiple notifications for same task on same day
}

export interface Reward {
  id: string;
  parentId: string;
  title: string;
  description: string;
  xpCost: number;
}

export interface ClaimedReward {
  id: string;
  kidId: string;
  rewardId: string;
  createdAt: any;
}
