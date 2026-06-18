export type UserRole = 'parent' | 'kid' | 'coparent';

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
  avatarPreset?: string;
  avatarUrl?: string;
}

export interface AppUser {
  uid: string;
  email?: string;
  name: string;
  displayName?: string;
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

export type TaskFrequency = 'daily' | 'weekdays' | 'twice-daily' | 'weekly' | 'bi-weekly' | 'custom';
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
  requiresApproval?: boolean;
  completionQuestions?: string[];
  completionQuestionsKidId?: string | null;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  kidId: string;
  completedAt: FirebaseTimestamp; // Firestore Timestamp
  dateString: string; // YYYY-MM-DD
  count?: number; // 1 or 2
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'skipped' | null;
  proofAnswers?: Array<{ question: string; answer: string }>;
}

export interface Invite {
  id: string; // The 6-digit code
  parentId: string;
  parentName: string;
  type?: 'kid' | 'coparent';
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
  sourceCalendarId?: string;
  // New fields
  isAllDay?: number;        // 0 or 1
  masterId?: string;        // links recurring instances
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEnd?: string;   // YYYY-MM-DD
  isCountdown?: number;     // 0 or 1
  reminderMinutes?: number | null;
  routineListId?: string | null;
  attendees?: EventAttendee[];
}

export type RsvpStatus = 'pending' | 'yes' | 'no' | 'maybe';

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  rsvp: RsvpStatus;
  name?: string;
}

export interface Homework {
  id: string;
  parentId: string;
  title: string;
  subject: string;
  notes?: string;
  dueDate: string;
  assignedToId?: string;
  status: 'pending' | 'done';
  color: string;
  createdAt: number;
  completionQuestions?: string[];
  completionQuestionsKidId?: string | null;
  completionResponse?: string | null;
  recurrence?: 'none' | 'daily' | 'weekdays';
}

export interface RoutineTemplate {
  id: string;
  parentId: string;
  title: string;
  description?: string;
  defaultStartTime?: string;
  defaultDuration: number;
  assignedToId?: string;
  color: string;
  createdAt: number;
  sortOrder?: number;
}

export interface FamilySettings {
  parentId: string;
  locationLat: number;
  locationLon: number;
  timezone: string;
  temperatureUnit?: 'celsius' | 'fahrenheit';
  timeFormat?: '12h' | '24h';
  pin?: string | null;
  hasPIN?: boolean;
  sleepStart?: string;
  sleepEnd?: string;
  isLocked?: boolean;
  photoCleanupEnabled?: boolean;
  photoCleanupIntervalHours?: number;
  googlePhotosEnabled?: boolean;
  googlePhotosAlbumId?: string | null;
  displayRotationEnabled?: boolean;
  displayRotationInterval?: number;
  displayRotationOrder?: string;
  screensaverShuffle?: boolean;
  screensaverDurationSec?: number;
  screensaverCaptions?: boolean;
  customStoreNames?: string[];
  customLocationNames?: string[];
}

export interface SyncConnection {
  id: string;
  parentId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
  email?: string | null;
  appPassword?: string | null;
  createdAt?: number;
  lastSyncAt?: number | null;
  lastSyncStatus?: 'ok' | 'partial' | 'error' | null;
}

export interface SyncCalendar {
  id: string;
  connectionId: string;
  parentId: string;
  calendarId: string;
  name: string;
  enabled: number | boolean;
  provider?: string;
  color?: string;
  isSharedCalendar?: number | boolean;
}

export interface AppList {
  id: string;
  parentId: string;
  title: string;
  locationName?: string; // e.g. 'Home', 'Car', 'School'
  isRoutine: number;    // 0 or 1
  category: 'shopping' | 'routine';
  createdAt: string;
  updatedAt: string;
}

export interface AppListItem {
  id: string;
  listId: string;
  text: string;
  completed: number;
  storeName?: string;
  locationName?: string; // Specific location override
  completedAt?: number;
  usageCount?: number;
}

export interface EventRoutineItem extends AppListItem {
  eventId: string;
}
export interface Recipe {
  id: string;
  parentId: string;
  name: string;
  ingredients: string; // JSON String of array
  instructions?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  favorite?: number | boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  caption?: string;
}

export interface FeatureFlags {
  wall_v2_layout: boolean;
  sync_diagnostics: boolean;
  calendar_visibility_profiles: boolean;
}

export interface MissionItem {
  id: string;
  type: 'event' | 'task' | 'list_item' | 'routine';
  title: string;
  subtitle?: string;
  time?: string;
  status: 'pending' | 'needs_approval' | 'completed';
  color?: string;
  originalData: Task | CalendarEvent | AppListItem | AppList;
  assignedToId?: string;
  storeName?: string;
  locationName?: string;
  listCategory?: 'shopping' | 'routine';
}

export interface NextUpEvent {
  title: string;
  startTime: number;
  memberName: string;
  memberColor: string;
}

export interface DailyIntelligence {
  nextUp: NextUpEvent | null;
  meal: {
    id: string;
    title: string;
    imageUrl?: string;
    ingredients?: string[];
  } | null;
}

export type WallMode = 'morning' | 'ambient' | 'afterschool' | 'evening' | 'night';

export interface StreakData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  multiplier: number;
  badgesEarned: string[];
}

export interface XpEvent {
  id: number;
  userId: string;
  parentId: string;
  xp: number;
  reason: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  weeklyXp: number;
  deltaFromLastWeek: number;
  role: 'parent' | 'kid' | 'coparent';
}

export interface PowerMission {
  taskId: string;
  title: string;
  xpReward: number;
  assignedKidId: string;
  assignedKidName: string;
}

export interface MissionCompletedPayload {
  userId: string;
  xp: number;
  streakDay: number;
  badgesEarned: string[];
}
