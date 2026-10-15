import type { Task } from "@/types";

// Which scope a page is looking at, and the two rules the dashboard's summary
// numbers are built from.
//
// Why this is shared rather than per-page: the Dashboard, the Calendar and the
// Tasks page all answer the same questions ("is this task part of today?",
// "which tasks count towards today's percentage?"). When each page worked it
// out separately, a task completed on a daily log but whose `status` was never
// ticked was counted as answered by one view and unfinished by another. These
// are the single definitions all three now use.

export type HomeScope = "home" | "course";

/** "A task the user can act on at home" - the default scope. */
export const HOME_SCOPE: HomeScope = "home";

/**
 * A scope is identified by its name. "Course" is recognised by name only, and
 * only in the `category` column, because DayForge has no separate courses table.
 * Anything that is not the word "course" belongs to the home scope, including
 * the post-login default categories (Personal, Assignment, Exam, ...).
 */
export function parseScope(value: string | null | undefined): HomeScope {
  return value?.trim().toLowerCase() === "course" ? "course" : HOME_SCOPE;
}

/** True when the task is inside the given scope. */
export function isInScope(task: Task, scope: HomeScope): boolean {
  return parseScope(task.category) === scope;
}

/** The tasks a page should show for a scope. */
export function tasksInScope(tasks: Task[], scope: HomeScope): Task[] {
  return tasks.filter((task) => isInScope(task, scope));
}

/**
 * True when the task is eligible for the daily Yes/No question today.
 *
 * Eligibility is derived from `status`, deliberately, and NOT from the due date.
 * That is the same rule the Dashboard's "Today's Tasks" panel has always used,
 * and keeping it in one place is what stops the panel and the numbers beside it
 * from disagreeing. Whether a task is *due* today is a separate question - see
 * `isDueToday` in hooks/useTasks.
 */
export function isTaskEligibleToday(task: Task): boolean {
  return task.status !== "done";
}

/** The eligible tasks in a scope: what goes into a completion percentage. */
export function eligibleTasks(tasks: Task[], scope: HomeScope): Task[] {
  return tasksInScope(tasks, scope).filter(isTaskEligibleToday);
}
