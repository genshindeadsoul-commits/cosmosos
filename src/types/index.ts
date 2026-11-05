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
  | 'mail';

export type DefaultTaskListType = 'Inbox' | 'Work' | 'Study' | 'Health' | 'Personal' | 'Holiday trip';
export type TaskListType = DefaultTaskListType | (string & {});
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'todo' | 'completed' | 'in_progress';

export interface CustomTaskListMeta {
  id: string;
  name: string;
  color?: string; // e.g. '#3B82F6' or tailwind class
  icon?: string;
  archived?: boolean;
}

export const TASK_LIST_METADATA: Record<DefaultTaskListType, { label: string; dotColor: string }> = {
  Inbox: { label: 'Inbox', dotColor: 'bg-purple-500' },
  Work: { label: 'Work', dotColor: 'bg-blue-500' },
  Study: { label: 'Study', dotColor: 'bg-amber-500' },
  Health: { label: 'Health', dotColor: 'bg-rose-500' },
  Personal: { label: 'Personal', dotColor: 'bg-emerald-500' },
  'Holiday trip': { label: 'Holiday trip', dotColor: 'bg-pink-500' },
};
export const TASK_LISTS: DefaultTaskListType[] = ['Inbox', 'Work', 'Study', 'Health', 'Personal', 'Holiday trip'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

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
  reminder?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD (start date)
  endDate?: string; // YYYY-MM-DD (end date for multi-day events)
  startTime: string;
  endTime: string;
  allDay?: boolean;
  color?: string;
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
  noteDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type TableColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'multi-select'
  | 'url'
  | 'currency'
  | 'status'
  | 'link';

export interface TableColumn {
  id: string;
  name: string;
  type: TableColumnType;
  options?: string[];
  currencySymbol?: string;
  hidden?: boolean;
  width?: number;
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface TableMetadata {
  view?: 'table' | 'list' | 'board';
  groupByColumnId?: string;
  calendarEnabled?: boolean;
  calendarDateFieldId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface TableCollection {
  id: string;
  name: string;
  description: string;
  columns: TableColumn[];
  rows: TableRow[];
  updatedAt: string;
  archived?: boolean;
  metadata?: TableMetadata;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type DefaultExpenseCategory =
  | 'Salary'
  | 'Groceries'
  | 'Transportation'
  | 'Dining'
  | 'Freelance'
  | 'Savings'
  | 'Entertainment'
  | 'Utilities'
  | 'Miscellaneous'
  | 'Affiliate'
  | 'Transfer';

export type ExpenseCategory = DefaultExpenseCategory | (string & {});

export const EXPENSE_CATEGORIES: DefaultExpenseCategory[] = [
  'Salary',
  'Groceries',
  'Transportation',
  'Dining',
  'Freelance',
  'Savings',
  'Entertainment',
  'Utilities',
  'Miscellaneous',
  'Affiliate',
];

export interface Transaction {
  id: string;
  type: TransactionType;
  category: ExpenseCategory;
  title?: string;
  description: string;
  amount: number;
  date: string;
  time?: string;
  notes?: string;
  account?: string;
  transferAccount?: string;
  tags?: string[];
  receiptUrl?: string;
  recurringId?: string;
}

export type AccountType = 'cash' | 'bank' | 'savings' | 'wallet' | 'credit' | 'custom';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  currency?: string;
  color?: string;
  isArchived?: boolean;
  createdAt?: string;
}

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-bank', name: 'Bank account', type: 'bank', openingBalance: 0, color: '#2563EB' },
  { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 0, color: '#16A34A' },
  { id: 'acc-savings', name: 'Savings account', type: 'savings', openingBalance: 0, color: '#D97706' },
  { id: 'acc-wallet', name: 'Digital wallet', type: 'wallet', openingBalance: 0, color: '#8B5CF6' },
];

export interface FinanceCategoryMeta {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategoryMeta[] = [
  { id: 'cat-salary', name: 'Salary', type: 'income', color: '#16A34A', isDefault: true },
  { id: 'cat-freelance', name: 'Freelance', type: 'income', color: '#0D9488', isDefault: true },
  { id: 'cat-affiliate', name: 'Affiliate', type: 'income', color: '#10B981', isDefault: true },
  { id: 'cat-savings', name: 'Savings', type: 'income', color: '#38543D', isDefault: true },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', color: '#526B55', isDefault: true },
  { id: 'cat-transport', name: 'Transportation', type: 'expense', color: '#8B5CF6', isDefault: true },
  { id: 'cat-dining', name: 'Dining', type: 'expense', color: '#D97706', isDefault: true },
  { id: 'cat-utilities', name: 'Utilities', type: 'expense', color: '#2563EB', isDefault: true },
  { id: 'cat-entertainment', name: 'Entertainment', type: 'expense', color: '#EC4899', isDefault: true },
  { id: 'cat-misc', name: 'Miscellaneous', type: 'expense', color: '#6B7067', isDefault: true },
];

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  title: string;
  type: TransactionType;
  category: ExpenseCategory;
  amount: number;
  account: string;
  transferAccount?: string;
  frequency: RecurringFrequency;
  interval?: number;
  startDate: string;
  nextDueDate: string;
  lastGeneratedDate?: string;
  status: 'active' | 'paused' | 'cancelled';
  notes?: string;
}

export interface Subscription {
  id: string;
  name: string;
  description?: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  renewalDate: string;
  account?: string;
  category?: string;
  status?: 'active' | 'paused' | 'cancelled';
  lastPaidDate?: string;
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
  durationMinutes: number | null;
  calories: number | null;
  exercises: ExerciseEntry[];
  notes?: string;
  source?: string;
  externalId?: string;
}

export type GoalCategory = 'FINANCE' | 'LEARNING' | 'FITNESS' | 'PROJECTS';
export const GOAL_CATEGORIES: GoalCategory[] = ['FINANCE', 'LEARNING', 'FITNESS', 'PROJECTS'];

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

/** Content for a new table. Row ids are intentionally absent: the app assigns real UUIDs. */
export type NewTable = Omit<TableCollection, 'id' | 'updatedAt' | 'rows'> & {
  rows?: Omit<TableRow, 'id'>[];
  metadata?: TableMetadata;
};
