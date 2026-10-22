export type ModuleType =
  | 'dashboard'
  | 'notes'
  | 'tables'
  | 'expenses'
  | 'fitness'
  | 'goals'
  | 'trackers'
  | 'tasks'
  | 'settings'
  | 'mail'
  | 'whatsapp'
  | 'admin';

export type TaskListType = 'Inbox' | 'Work' | 'Study' | 'Health' | 'Personal' | 'Holiday trip';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'todo' | 'completed' | 'in_progress';

export interface Task {
  id: string;
  title: string;
  description?: string;
  list: TaskListType;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM AM/PM
  isFocus?: boolean;
  linkedNoteId?: string;
  recurrence?: 'daily' | 'weekly' | 'monthly';
  createdAt: string;
  completedAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  category: string;
  location?: string;
  source: 'local' | 'google_calendar';
  providerId?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  starred?: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TableColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'status' | 'link';
  options?: string[];
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface TableCollection {
  id: string;
  name: string;
  description: string;
  columns: TableColumn[];
  rows: TableRow[];
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense';
export type ExpenseCategory =
  | 'Salary'
  | 'Groceries'
  | 'Transportation'
  | 'Dining'
  | 'Freelance'
  | 'Savings'
  | 'Entertainment'
  | 'Utilities'
  | 'Miscellaneous'
  | 'Affiliate';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  time?: string;
  notes?: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  renewalDate: string;
}

export interface ExerciseEntry {
  name: string;
  setsReps: string;
  weightLbs?: number;
}

export interface WorkoutLog {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  calories: number;
  exercises: ExerciseEntry[];
  notes?: string;
}

export type GoalCategory = 'FINANCE' | 'LEARNING' | 'FITNESS' | 'PROJECTS';

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  current: number;
  target: number;
  unit: string;
  targetDate: string;
  completed: boolean;
}

export interface Habit {
  id: string;
  name: string;
  category: string;
  streak: number;
  checkins: Record<string, boolean>; // date -> completed
}

export interface CustomTrackerEntry {
  id: string;
  date: string;
  value: number;
  notes?: string;
}

export interface CustomTracker {
  id: string;
  name: string;
  unit: string;
  targetPerDay: number;
  entries: CustomTrackerEntry[];
}

export type IntegrationStatus =
  | 'connected'
  | 'not_connected'
  | 'needs_reauthorization'
  | 'config_required'
  | 'temporarily_unavailable'
  | 'error'
  | 'disconnected';

export interface IntegrationAccount {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  connectedEmail?: string;
  lastSync?: string;
  permissions: string[];
  syncDirection: string;
  requiresConfig?: boolean;
  endpointUrl?: string;
  appDeepLink?: string;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserProfile {
  name: string;
  email: string;
  workspaceName: string;
  avatarInitials: string;
  role: string;
  accountType: 'Cloud Synchronized';
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  durationSeconds: number;
  externalUrl?: string;
}

export interface MusicPlayerState {
  isOpen: boolean;
  isMinimized: boolean;
  provider: 'ambient' | 'spotify';
  isPlaying: boolean;
  currentTrack: string;
  artist: string;
  albumArt?: string;
  progressSeconds: number;
  durationSeconds: number;
  volume: number; // 0 to 1
  ambientPreset?: 'forest' | 'rain' | 'alpha' | 'celestial';
  spotifyActiveDevice?: string;
  activeTrackIndex?: number;
  /** External providers only: truthful connection state reported by the provider calls. */
  externalStatus?: 'unknown' | 'ok' | 'not_connected' | 'not_authorized' | 'error';
  externalMessage?: string;
}

export interface GmailMessage {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
  isStarred?: boolean;
}
