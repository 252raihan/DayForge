// Shared TypeScript types for DayForge.
//
// These mirror the database schema. Every table carries a `user_id` (or, for
// profiles, `id`) column plus RLS, so a user only ever sees their own rows.

/** Appearance preference. 'system' follows the OS setting. */
export type ThemePreference = "light" | "dark" | "system";

/** Which weekday the Calendar week view starts on. 0 = Sun, 1 = Mon. */
export type WeekStart = 0 | 1;

/** A row from `public.profiles`. One per user; created by a DB trigger. */
export type Profile = {
  id: string;
  name: string | null;
  university: string | null;
  department: string | null;
  semester: string | null;
  created_at: string;
  /** Added by the 2026-10-15 migration. */
  theme: ThemePreference;
  week_start: number;
  default_task_category: string | null;
  default_task_priority: TaskPriority | null;
  show_completed_tasks: boolean;
  updated_at: string;
};

/** Fields the user may edit on the Settings page. */
export type ProfileUpdate = Pick<
  Profile,
  "name" | "university" | "department" | "semester"
>;

/** The preference fields Settings writes to `public.profiles`. */
export type DisplayPreferences = {
  theme: ThemePreference;
  week_start: number;
  default_task_category: string | null;
  default_task_priority: TaskPriority | null;
  show_completed_tasks: boolean;
};

/** A row from `public.user_preferences` - display settings that are not on the profile. */
export type UserPreferences = {
  user_id: string;
  /** '12h' renders "2:30 PM", '24h' renders "14:30". */
  time_format: "12h" | "24h";
  week_start: number;
  default_category: string | null;
  default_priority: TaskPriority | null;
  show_completed_tasks: boolean;
  created_at: string;
  updated_at: string;
};

/** A row from `public.notes`. */
export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  pinned: boolean;
  /** Optional link to a task. NULL when the note stands alone. */
  task_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Payload for creating a note. `user_id` is filled in by the database default. */
export type NoteInsert = {
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  pinned?: boolean;
  task_id?: string | null;
};

/** Payload for editing a note - everything optional. */
export type NoteUpdate = Partial<NoteInsert>;

/** Sort orders offered by the Notes list. */
export type NoteSort = "updated" | "created" | "title";

/** How often a habit is meant to be done. */
export type HabitFrequency = "daily" | "weekly" | "custom";

/** A row from `public.habits`. */
export type Habit = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  /** Weekdays (0 = Sun .. 6 = Sat) for `frequency = 'weekly'`. */
  habit_days: number[] | null;
  /** Completions wanted per week for `frequency = 'custom'`. */
  target_per_week: number | null;
  archived: boolean;
  created_at: string;
};

/** Payload for creating or editing a habit. */
export type HabitInsert = {
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  habit_days: number[] | null;
  target_per_week: number | null;
};

/** Payload for editing a habit - everything optional. */
export type HabitUpdate = Partial<HabitInsert> & { archived?: boolean };

/** A row from `public.habit_logs` - one check-in, one habit, one day. */
export type HabitLog = {
  id: string;
  user_id: string;
  habit_id: string;
  /** Calendar day in the user's own timezone, as YYYY-MM-DD. */
  log_date: string;
  done: boolean;
  created_at: string;
};

/**
 * A habit plus the streak and schedule numbers derived from its persisted
 * check-ins. Nothing here is estimated: `currentStreak` walks backwards through
 * real rows, and a day the user has not answered yet never breaks it.
 */
export type HabitStats = {
  habit: Habit;
  /** 0-7, using `week_start` to decide where the week begins. */
  dueToday: boolean;
  /** True when the previous week missed the target (custom frequency only). */
  missedLastWeek: boolean;
  currentStreak: number;
  bestStreak: number;
  /** Check-ins in the last 7 days. */
  completedLast7: number;
  targetLast7: number;
  completedThisWeek: number;
  targetThisWeek: number;
  totalCompletions: number;
  /** Oldest first, one entry per day inside the chart window. */
  recent: (HabitLog | null)[];
};

/** How a challenge measures progress. */
export type ChallengeGoalType =
  | "manual"
  | "checkin_count"
  | "task_completion"
  | "habit_completion";

/** A row from `public.challenges`. */
export type Challenge = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  target_date: string | null;
  goal_type: ChallengeGoalType;
  goal_target: number | null;
  created_at: string;
};

/** Payload for creating or editing a challenge. */
export type ChallengeInsert = {
  title: string;
  description: string | null;
  start_date: string;
  target_date: string | null;
  goal_type: ChallengeGoalType;
  goal_target: number | null;
};

/** Payload for editing a challenge - everything optional. */
export type ChallengeUpdate = Partial<ChallengeInsert>;

/** A row from `public.challenge_checkins`. */
export type ChallengeCheckin = {
  id: string;
  user_id: string;
  challenge_id: string;
  log_date: string;
  note: string | null;
  created_at: string;
};

/** Where a challenge stands, derived from real records only. */
export type ChallengeStatus =
  | "not_started"
  | "active"
  | "completed"
  | "expired";

/** A challenge plus its measured progress. */
export type ChallengeProgress = {
  challenge: Challenge;
  status: ChallengeStatus;
  /** The measured count: check-ins, or completions inside the window. */
  current: number;
  /** The target in the same unit. Null when the challenge has no numeric goal. */
  target: number | null;
  /** 0-100 integer, or null when there is no target to divide by. */
  percent: number | null;
  /** Whole days from today to `target_date` (negative = past). */
  daysRemaining: number | null;
  /** Check-ins recorded today (checkin_count challenges only). */
  checkedInToday: boolean;
};

/** Allowed values for `tasks.priority` (matches the DB check constraint). */
export type TaskPriority = "low" | "medium" | "high";

/** Allowed values for `tasks.status` (matches the DB check constraint). */
export type TaskStatus = "todo" | "in_progress" | "done";

/**
 * Allowed values for `tasks.recurrence_type` (matches the DB check constraint
 * `tasks_recurrence_type_check`).
 */
export type RecurrenceType = "none" | "daily" | "weekly" | "custom";

/** A row from `public.tasks`. */
export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  /** ISO 8601 UTC instant, or null when the task has no due date. */
  due_at: string | null;
  priority: TaskPriority;
  category: string;
  status: TaskStatus;
  created_at: string;
  /** none | daily | weekly | custom. Defaults to 'none' in the database. */
  recurrence_type: RecurrenceType;
  /**
   * Weekdays (0 = Sunday .. 6 = Saturday) for `recurrence_type = 'custom'`.
   * NULL for every other recurrence type.
   */
  recurrence_days: number[] | null;
  /**
   * The task this row is the next occurrence of. NULL for ordinary tasks. The
   * pair (recurrence_source_id, due_at) is unique in the database, which is what
   * stops a completed recurring task from spawning a duplicate occurrence.
   */
  recurrence_source_id: string | null;
};

/**
 * Payload for creating a task. `user_id` is filled in by the database default.
 *
 * The two `default_*` fields are the caller's Settings preferences. They exist
 * so every creation path - the Tasks modal, the Calendar's "add on this date"
 * and a recurring task spawning its next occurrence - resolves the same
 * defaults in the same way, instead of each caller guessing.
 */
export type TaskInsert = {
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  category: string;
  recurrence_type: RecurrenceType;
  recurrence_days: number[] | null;
  default_category?: string | null;
  default_priority?: TaskPriority | null;
};

/** Payload for editing a task - everything optional. */
export type TaskUpdate = Partial<TaskInsert> & {
  status?: TaskStatus;
  /** Set on a generated occurrence to point back at the task it repeats. */
  recurrence_source_id?: string | null;
};

/** The tabs on the Tasks page. */
export type TaskFilter = "today" | "upcoming" | "overdue" | "all";

/** Sort keys offered by the Tasks toolbar. */
export type TaskSort = "due_date" | "priority" | "created";

/** A row from `public.subtasks` - one checklist item on a task. */
export type SubTask = {
  id: string;
  user_id: string;
  task_id: string;
  title: string;
  done: boolean;
  created_at: string;
};

/** Payload for creating a subtask. `user_id` is filled in by a DB trigger. */
export type SubTaskInsert = {
  task_id: string;
  title: string;
};

/**
 * The daily status a user picks for a task: "Yes" completed it, "No" did not.
 * Stored as the boolean `task_daily_logs.completed`.
 */
export type DailyStatus = "yes" | "no";

/** A row from `public.task_daily_logs` - one task's status for one day. */
export type TaskDailyLog = {
  id: string;
  user_id: string;
  task_id: string;
  /** Calendar day in the user's own timezone, as YYYY-MM-DD. */
  log_date: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

/** Payload for submitting a day's status. `user_id` defaults to auth.uid(). */
export type TaskDailyLogInsert = {
  task_id: string;
  log_date: string;
  completed: boolean;
};

/** One day's cell in a task's history chart. */
export type DailyPoint = {
  /** YYYY-MM-DD. */
  date: string;
  completed: boolean;
};

/** A task's daily history plus the derived consistency numbers. */
export type TaskProgress = {
  task: Task;
  /** Oldest first, one entry per day that has a log. */
  history: DailyPoint[];
  /** Days marked "Yes". */
  completedDays: number;
  /** Days with any log at all ("Yes" or "No"). */
  trackedDays: number;
  /** completedDays / trackedDays, as a 0-100 integer. 0 when nothing tracked. */
  completionRate: number;
};

/** A task's progress for the Today panel, plus today's answer (null = unanswered). */
export type TodayTaskProgress = TaskProgress & {
  today: DailyStatus | null;
};

export { };
