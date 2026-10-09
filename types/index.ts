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
};

/** Payload for creating a task. `user_id` is filled in by the database default. */
export type TaskInsert = {
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  category: string;
};

/** Payload for editing a task - everything optional. */
export type TaskUpdate = Partial<TaskInsert> & { status?: TaskStatus };

/** The tabs on the Tasks page. */
export type TaskFilter = "today" | "upcoming" | "overdue" | "all";

export { };
