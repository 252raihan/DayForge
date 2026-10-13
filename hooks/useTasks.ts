"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  SubTask,
  Task,
  TaskFilter,
  TaskInsert,
  TaskPriority,
  TaskSort,
  TaskUpdate,
} from "@/types";

// All Task data access lives here, so the page and its components stay free of
// Supabase calls. The hook owns: the task list, the subtask checklists, the
// loading/error state, the toolbar state (search, filters, sort) and every
// mutation (create, update, toggle, delete, subtasks).
//
// /tasks and the Dashboard both call this hook, so they always agree on what a
// tab means and on what the counts are.

// Since the whole list is fetched anyway and RLS scopes it to one user, all
// filtering and sorting happens client-side. That keeps tab switches and typing
// instant and avoids a round-trip per change. (For a very large list you would
// push filtering into the query and paginate instead.)

/** The sort order applied before the user picks one. */
export const DEFAULT_SORT: TaskSort = "due_date";

/** Priority rank used by the "priority" sort - high first. */
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Sentinel for "any category" in the category filter dropdown. */
export const ALL_CATEGORIES = "__all__";

/** Sentinel for "any status" in the status filter dropdown. */
export const ALL_STATUSES = "__all__";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  // Subtasks are kept in one flat list keyed by task id, because they are only
  // ever rendered grouped by task. One query loads every checklist at once.
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Toolbar state ------------------------------------------------------
  const [filter, setFilter] = useState<TaskFilter>("all");
  // `search` is what the input binds to; `debouncedSearch` is what filtering
  // actually uses, 300ms behind. Keeping both means typing never stutters.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [sort, setSort] = useState<TaskSort>(DEFAULT_SORT);

  // Debounce the search box by 300ms. The timer is cleared on every keystroke,
  // so the list only recomputes once the user pauses.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch tasks and their subtasks on mount. `load` is reused by the retry
  // button and by the dashboard's refetch-on-mount.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // RLS scopes both queries to the signed-in user, so no explicit filter is
    // needed beyond the ordering.
    const [tasksResult, subtasksResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        // Soonest due date first; tasks with no due date go last.
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("subtasks")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    // Surface the real Supabase message so the banner is diagnosable.
    if (tasksResult.error) {
      console.error("[DayForge] failed to load tasks:", tasksResult.error.message);
      setError(tasksResult.error.message);
      setLoading(false);
      return;
    }

    if (subtasksResult.error) {
      console.error("[DayForge] failed to load subtasks:", subtasksResult.error.message);
      setError(subtasksResult.error.message);
      setLoading(false);
      return;
    }

    setTasks((tasksResult.data as Task[]) ?? []);
    setSubtasks((subtasksResult.data as SubTask[]) ?? []);
    // Clear any previous failure so the banner disappears on a good reload.
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Creates a task and prepends it, so the list updates without a refetch. */
  const createTask = useCallback(async (values: TaskInsert) => {
    const supabase = createClient();

    // user_id is omitted on purpose: the column defaults to auth.uid().
    const { data, error } = await supabase
      .from("tasks")
      .insert(values)
      .select()
      .single();

    if (error) {
      console.error("[DayForge] failed to create task:", error.message);
      throw new Error("Could not save the task. Please try again.");
    }

    setTasks((prev) => [data as Task, ...prev]);
    return data as Task;
  }, []);

  /**
   * Patches a task. Applied optimistically so the checkbox feels instant, and
   * rolled back if the server rejects it.
   */
  const updateTask = useCallback(async (id: string, values: TaskUpdate) => {
    const supabase = createClient();

    let snapshot: Task | undefined;
    setTasks((prev) => {
      snapshot = prev.find((t) => t.id === id);
      return prev.map((t) => (t.id === id ? { ...t, ...values } : t));
    });

    const { error } = await supabase.from("tasks").update(values).eq("id", id);

    if (error) {
      console.error("[DayForge] failed to update task:", error.message);
      // Restore the previous row.
      if (snapshot) {
        const previous = snapshot;
        setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
      }
      throw new Error("Could not update the task. Please try again.");
    }
  }, []);

  /**
   * Inserts the next occurrence of a recurring task and prepends it.
   *
   * Deliberately non-throwing: the completion itself already succeeded, and a
   * rejected insert is the expected outcome of a duplicate, not an error the
   * user needs to see.
   */
  const spawnNextOccurrence = useCallback(async (task: Task) => {
    if (!isRecurring(task) || !task.due_at) return;

    const nextDueAt = nextOccurrence(task);
    if (!nextDueAt) return;

    const supabase = createClient();

    // The new row points at the ORIGINAL task (recurrence_source_id), not at
    // this row, so every occurrence of a series shares one source. The unique
    // index is on (source, due_at) - a stable pair - which is exactly what makes
    // the guard idempotent no matter how often the button is clicked.
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: task.title,
        description: task.description,
        due_at: nextDueAt,
        priority: task.priority,
        category: task.category,
        status: "todo" as const,
        recurrence_type: task.recurrence_type,
        recurrence_days: task.recurrence_days,
        recurrence_source_id: task.recurrence_source_id ?? task.id,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation. That is the duplicate-protection index doing
      // its job (the occurrence already exists), so stay quiet about it.
      if (isUniqueViolation(error)) return;
      console.error("[DayForge] failed to create next occurrence:", error.message);
      return;
    }

    setTasks((prev) => [data as Task, ...prev]);
  }, []);

  /**
   * Flips a task between todo and done.
   *
   * Marking a recurring task done also schedules its next occurrence. The insert
   * is protected by the partial unique index `tasks_recurrence_occurrence_key`
   * on (recurrence_source_id, due_at), so a double click, an undo/redo, or two
   * tabs racing cannot produce two copies of the same occurrence: the losing
   * insert fails with SQLSTATE 23505 and is swallowed on purpose.
   */
  const toggleTask = useCallback(
    async (task: Task) => {
      const nextStatus = task.status === "done" ? "todo" : "done";
      await updateTask(task.id, { status: nextStatus });

      if (nextStatus === "done") {
        await spawnNextOccurrence(task);
      }
    },
    [updateTask, spawnNextOccurrence],
  );

  /** Deletes a task, removing it locally only after the server confirms. */
  const deleteTask = useCallback(async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      console.error("[DayForge] failed to delete task:", error.message);
      throw new Error("Could not delete the task. Please try again.");
    }

    // The database cascades the delete to the task's subtasks (subtasks_task_fk
    // ... ON DELETE CASCADE), so mirror that locally instead of refetching.
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSubtasks((prev) => prev.filter((s) => s.task_id !== id));
  }, []);

  // --- Mutations: subtasks ------------------------------------------------

  /**
   * Adds a checklist item to a task. Returns nothing: the caller only needs to
   * know that it succeeded (it throws otherwise).
   */
  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const supabase = createClient();

    // user_id is omitted: a database trigger stamps it from the parent task,
    // and the composite foreign key keeps the two owners identical.
    const { data, error } = await supabase
      .from("subtasks")
      .insert({ task_id: taskId, title: trimmed })
      .select()
      .single();

    if (error) {
      console.error("[DayForge] failed to add subtask:", error.message);
      throw new Error("Could not add the subtask. Please try again.");
    }

    setSubtasks((prev) => [...prev, data as SubTask]);
  }, []);

  /** Ticks a subtask on or off, optimistically. */
  const toggleSubtask = useCallback(async (subtask: SubTask) => {
    const supabase = createClient();
    const nextDone = !subtask.done;

    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtask.id ? { ...s, done: nextDone } : s)),
    );

    const { error } = await supabase
      .from("subtasks")
      .update({ done: nextDone })
      .eq("id", subtask.id);

    if (error) {
      console.error("[DayForge] failed to update subtask:", error.message);
      // Roll the checkbox back so it never lies about what is stored.
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, done: subtask.done } : s)),
      );
      throw new Error("Could not update the subtask. Please try again.");
    }
  }, []);

  /** Deletes a subtask, removing it locally only after the server confirms. */
  const deleteSubtask = useCallback(async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase.from("subtasks").delete().eq("id", id);

    if (error) {
      console.error("[DayForge] failed to delete subtask:", error.message);
      throw new Error("Could not delete the subtask. Please try again.");
    }

    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // --- Derived state ------------------------------------------------------

  // Subtasks grouped by task, so a card can read its own checklist in O(1).
  const subtasksByTask = useMemo(() => {
    const map = new Map<string, SubTask[]>();
    for (const subtask of subtasks) {
      const list = map.get(subtask.task_id);
      if (list) list.push(subtask);
      else map.set(subtask.task_id, [subtask]);
    }
    return map;
  }, [subtasks]);

  /** Every category in use, for the category filter dropdown. */
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) set.add(task.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  /**
   * The list once search, filters and sort are applied, but BEFORE the tab is
   * applied. This is what the tab counts are derived from, which is what keeps
   * the counts and the visible rows telling the same story.
   */
  const searched = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();

    const matched = tasks.filter((task) => {
      // Search covers title and description together.
      if (needle) {
        const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (priority && task.priority !== priority) return false;
      if (category !== ALL_CATEGORIES && task.category !== category) return false;
      if (status !== ALL_STATUSES && task.status !== status) return false;
      return true;
    });

    // Sort a copy - Array.prototype.sort mutates.
    return [...matched].sort(comparator(sort));
  }, [tasks, debouncedSearch, priority, category, status, sort]);

  // The visible list for the active tab.
  const filteredTasks = useMemo(
    () => searched.filter((task) => matchesFilter(task, filter)),
    [searched, filter],
  );

  // Counts per tab, over the searched/filtered set, so they add up to what the
  // user can actually see.
  const counts = useMemo(
    () => ({
      today: searched.filter((t) => matchesFilter(t, "today")).length,
      upcoming: searched.filter((t) => matchesFilter(t, "upcoming")).length,
      overdue: searched.filter((t) => matchesFilter(t, "overdue")).length,
      all: searched.length,
    }),
    [searched],
  );

  /** True when the toolbar is narrowing the list in some way. */
  const hasActiveRefinements =
    debouncedSearch.trim() !== "" ||
    priority !== null ||
    category !== ALL_CATEGORIES ||
    status !== ALL_STATUSES;

  /** Puts the toolbar back to its defaults. The tab is left alone. */
  const clearRefinements = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setPriority(null);
    setCategory(ALL_CATEGORIES);
    setStatus(ALL_STATUSES);
  }, []);

  return {
    // Data
    tasks: filteredTasks,
    allTasks: tasks,
    subtasksByTask,
    counts,
    categories,
    loading,
    error,

    // Tab
    filter,
    setFilter,

    // Toolbar
    search,
    setSearch,
    priority,
    setPriority,
    category,
    setCategory,
    status,
    setStatus,
    sort,
    setSort,
    hasActiveRefinements,
    clearRefinements,

    // Task mutations
    reload: load,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,

    // Subtask mutations
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Builds the comparator for a sort key. Nulls always sort last. */
function comparator(sort: TaskSort): (a: Task, b: Task) => number {
  switch (sort) {
    case "due_date":
      return (a, b) => {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : null;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : null;
        if (aDue === null && bDue === null) return createdAtDesc(a, b);
        if (aDue === null) return 1;
        if (bDue === null) return -1;
        if (aDue !== bDue) return aDue - bDue;
        return createdAtDesc(a, b);
      };
    case "priority":
      return (a, b) => {
        const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (diff !== 0) return diff;
        // Within a priority band, soonest deadline first.
        return comparator("due_date")(a, b);
      };
    case "created":
      return createdAtDesc;
  }
}

/** Newest first. */
function createdAtDesc(a: Task, b: Task): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

/** True when the task repeats and therefore has a next occurrence to create. */
export function isRecurring(task: Task): boolean {
  if (task.recurrence_type === "daily" || task.recurrence_type === "weekly") {
    return true;
  }
  return (
    task.recurrence_type === "custom" &&
    Array.isArray(task.recurrence_days) &&
    task.recurrence_days.length > 0
  );
}

/**
 * The UTC instant of the next occurrence after `task.due_at`, as an ISO string.
 *
 * Daily and weekly simply step the anchor forward (a week is anchored on the due
 * date, so "weekly" always lands on the same weekday as the task's first due
 * date). Custom days walk forward to the first selected weekday strictly after
 * the due date, searching at most a full week ahead.
 *
 * Returns null when the task has no due date or no usable recurrence, because
 * "the next occurrence" is undefined without an anchor.
 */
export function nextOccurrence(task: Task): string | null {
  if (!task.due_at) return null;

  const due = new Date(task.due_at);
  if (Number.isNaN(due.getTime())) return null;

  if (task.recurrence_type === "daily") {
    return addDays(due, 1).toISOString();
  }

  if (task.recurrence_type === "weekly") {
    return addDays(due, 7).toISOString();
  }

  if (task.recurrence_type === "custom") {
    const days = (task.recurrence_days ?? []).filter((d) => d >= 0 && d <= 6);
    if (days.length === 0) return null;

    // Keep the time of day and step the calendar day, so a 9am task stays at 9am.
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = addDays(due, offset);
      if (days.includes(candidate.getDay())) return candidate.toISOString();
    }
    return null;
  }

  return null;
}

/**
 * Adds whole days using local calendar arithmetic (so a DST change does not
 * shift the time of day), then hands back the same absolute instant.
 */
function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Detects a unique-constraint violation.
 *
 * PostgREST reports it as SQLSTATE 23505 with HTTP 409. The message is checked
 * too, so a differently-shaped error from a proxy is still recognised.
 */
function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  if (error.code === "23505") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("duplicate key value") || message.includes("unique constraint");
}

/** Weekday labels for the custom-days picker, indexed 0 = Sunday. */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Short human description of a recurrence, for the task card. */
export function recurrenceLabel(task: Task): string | null {
  switch (task.recurrence_type) {
    case "daily":
      return "Repeats daily";
    case "weekly":
      return "Repeats weekly";
    case "custom": {
      const days = (task.recurrence_days ?? [])
        .filter((d) => d >= 0 && d <= 6)
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_LABELS[d]);
      return days.length > 0 ? `Repeats ${days.join(", ")}` : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tab logic
// ---------------------------------------------------------------------------

/** True when the task's due date falls on the current local day. */
export function isDueToday(task: Task): boolean {
  if (!task.due_at) return false;
  return isSameLocalDay(new Date(task.due_at), new Date());
}

/**
 * Overdue = has a due date in the past and is not done.
 * Compared as instants, so this is timezone-correct: the browser's local clock
 * is what decides "in the past".
 */
export function isOverdue(task: Task): boolean {
  if (!task.due_at) return false;
  if (task.status === "done") return false;
  return new Date(task.due_at).getTime() < Date.now();
}

/** Upcoming = due after today (tomorrow onward), and not done. */
export function isUpcoming(task: Task): boolean {
  if (!task.due_at) return false;
  if (task.status === "done") return false;
  // Later than the end of today (local).
  return new Date(task.due_at).getTime() > endOfToday().getTime();
}

export function matchesFilter(task: Task, filter: TaskFilter): boolean {
  switch (filter) {
    case "today":
      // Overdue items are excluded here - they get their own tab.
      return isDueToday(task) && !isOverdue(task);
    case "upcoming":
      return isUpcoming(task);
    case "overdue":
      return isOverdue(task);
    case "all":
      return true;
  }
}

/** Local midnight at the end of today. */
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Same calendar day in the browser's local timezone. */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Date helpers shared with the UI
// ---------------------------------------------------------------------------

/**
 * Converts a `datetime-local` input value (e.g. "2026-10-09T14:30"), which is
 * in the user's local time, into a UTC ISO string for storage.
 */
export function localInputToUtc(value: string): string | null {
  if (!value) return null;
  const date = new Date(value); // parsed as local time
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Converts a stored UTC timestamp into the value a `datetime-local` input
 * expects, in the user's local timezone.
 */
export function utcToLocalInput(utc: string | null): string {
  if (!utc) return "";
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return "";

  // Build YYYY-MM-DDTHH:mm from local parts (not toISOString, which is UTC).
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
