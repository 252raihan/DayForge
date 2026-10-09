"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskFilter, TaskInsert, TaskUpdate } from "@/types";

// All Task data access lives here, so the page and its components stay free of
// Supabase calls. The hook owns: the task list, loading/error state, and every
// mutation (create, update, toggle, delete).

// Since the whole list is fetched anyway and RLS scopes it to one user, tab
// filtering happens client-side. That keeps tab switches instant and avoids a
// round-trip per tab. (For a very large list you would push filtering into the
// query and paginate instead.)
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");

  // Fetch on mount. `load` is reused by the retry button.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      // Soonest due date first; tasks with no due date go last.
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[DayForge] failed to load tasks:", error.message);
      // Surface the real Supabase message so the banner is diagnosable.
      setError(error.message);
      setLoading(false);
      return;
    }

    setTasks((data as Task[]) ?? []);
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

  /** Flips a task between todo and done. */
  const toggleTask = useCallback(
    async (task: Task) => {
      const nextStatus = task.status === "done" ? "todo" : "done";
      await updateTask(task.id, { status: nextStatus });
    },
    [updateTask],
  );

  /** Deletes a task, removing it locally only after the server confirms. */
  const deleteTask = useCallback(async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      console.error("[DayForge] failed to delete task:", error.message);
      throw new Error("Could not delete the task. Please try again.");
    }

    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // The visible list for the active tab.
  const filteredTasks = useMemo(
    () => tasks.filter((task) => matchesFilter(task, filter)),
    [tasks, filter],
  );

  // Counts per tab, so the tab labels can show how much is in each.
  const counts = useMemo(
    () => ({
      today: tasks.filter((t) => matchesFilter(t, "today")).length,
      upcoming: tasks.filter((t) => matchesFilter(t, "upcoming")).length,
      overdue: tasks.filter((t) => matchesFilter(t, "overdue")).length,
      all: tasks.length,
    }),
    [tasks],
  );

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    counts,
    loading,
    error,
    filter,
    setFilter,
    reload: load,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
  };
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

function matchesFilter(task: Task, filter: TaskFilter): boolean {
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
