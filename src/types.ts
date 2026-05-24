export type UserRole = 'parent' | 'kid';

type FirebaseTimestamp = { seconds: number; nanoseconds?: number } | number;

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
  currentStreak?: number;
  earnedStars?: number;
  spentStars?: number;
  color?: string;
}

export interface EarnedBadge {
  id: string;
  earnedAt: FirebaseTimestamp;
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
  createdAt: FirebaseTimestamp; // Firestore Timestamp
  customInterval?: number; // Days for custom frequency
  prerequisiteTaskIds?: string[];
  starValue?: number;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  kidId: string;
  completedAt: FirebaseTimestamp; // Firestore Timestamp
  dateString: string; // YYYY-MM-DD
  count?: number; // 1 or 2
}

export interface Invite {
  id: string; // The 6-digit code
  parentId: string;
  parentName: string;
  createdAt: FirebaseTimestamp;
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
  createdAt: FirebaseTimestamp;
  dateString: string; // To avoid multiple notifications for same task on same day
}

export interface Reward {
  id: string;
  parentId: string;
  title: string;
  description: string;
  xpCost: number;
  starCost?: number;
  allowanceCents?: number;
}

export interface AllowanceEntry {
  id: string;
  kidId: string;
  parentId: string;
  rewardId: string;
  rewardTitle: string;
  amountCents: number;
  status: 'pending' | 'paid';
  claimedAt: string;
  paidAt?: string;
  kidName?: string;
}

export interface ClaimedReward {
  id: string;
  kidId: string;
  rewardId: string;
  createdAt: FirebaseTimestamp;
}

export interface CalendarEvent {
  id: string;
  parentId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  assignedToId?: string;
  color: string;
  externalId?: string;
  source?: string;
}

export interface FamilySettings {
  parentId: string;
  locationLat: number;
  locationLon: number;
  timezone: string;
  pin?: string | null;
  sleepStart?: string;
  sleepEnd?: string;
}

export interface SyncConnection {
  id: string;
  parentId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
}

export interface AppList {
  id: string;
  parentId: string;
  title: string;
}

export interface AppListItem {
  id: string;
  listId: string;
  text: string;
  completed: number; 
}

export interface Recipe {
  id: string;
  parentId: string;
  name: string;
  ingredients: string; // JSON String of array
}

export interface MealPlan {
  id: string;
  parentId: string;
  date: string;
  mealType: string;
  recipeId: string;
}

export interface FamilyPhoto {
  id: string;
  parentId: string;
  url: string;
  uploadedAt: string;
}
