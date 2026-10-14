// Shared TypeScript types for DayForge.
//
// These mirror the database schema. Every table carries a `user_id` (or, for
// profiles, `id`) column plus RLS, so a user only ever sees their own rows.

/** A row from `public.profiles`. One per user; created by a DB trigger. */
export type Profile = {
  id: string;
  name: string | null;
  university: string | null;
  department: string | null;
  semester: string | null;
  created_at: string;
};

/** Fields the user may edit on the Settings page. */
export type ProfileUpdate = Pick<
  Profile,
  "name" | "university" | "department" | "semester"
>;

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

/** Payload for creating a task. `user_id` is filled in by the database default. */
export type TaskInsert = {
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  category: string;
  recurrence_type: RecurrenceType;
  recurrence_days: number[] | null;
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
