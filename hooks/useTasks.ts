"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HOME_SCOPE, isTaskEligibleToday, tasksInScope, type HomeScope } from "@/lib/home-scope";
import type {
  DailyPoint,
  DailyStatus,
  SubTask,
  Task,
  TaskDailyLog,
  TaskFilter,
  TaskInsert,
  TaskPriority,
  TaskProgress,
  TaskSort,
  TaskUpdate,
  TodayTaskProgress,
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

/** Number of days the dashboard's daily-completion window covers. */
export const DAILY_STATS_DAYS = 21;

/**
 * Orders two tasks for the recurrence roll-up: dated rows first, earliest
 * first, undated last. Kept separate from `comparator` because it only ever
 * needs "which occurrence is next", not the user's chosen sort.
 */
function dueRank(task: Task): number {
  if (!task.due_at) return Number.POSITIVE_INFINITY;
  const time = new Date(task.due_at).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/** Priority rank used by the "priority" sort - high first. */
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Sentinel for "any category" in the category filter dropdown. */
export const ALL_CATEGORIES = "__all__";

/** Sentinel for "any status" in the status filter dropdown. */
export const ALL_STATUSES = "__all__";

// ---------------------------------------------------------------------------
// Error diagnostics
// ---------------------------------------------------------------------------
// Supabase/PostgREST errors carry more than a message: a stable Postgres or
// PostgREST `code`, plus optional details/hint. Logging all four at the point
// of failure is what makes a database-side problem diagnosable from the browser
// console without exposing any secrets - these fields are error metadata, not
// credentials or user data. The user-facing message stays friendly; the raw
// shape goes to the console only.
function logSupabaseError(scope: string, error: unknown): void {
  const err = error as { code?: string; message?: string; details?: string | null; hint?: string | null };
  console.error(
    `[DayForge] ${scope} failed:`,
    JSON.stringify(
      {
        code: err?.code ?? null,
        message: err?.message ?? null,
        details: err?.details ?? null,
        hint: err?.hint ?? null,
      },
      null,
      2,
    ),
  );
}

export function useTasks(
  scope: HomeScope = HOME_SCOPE,
  options: { hideCompleted?: boolean } = {},
) {
  const hideCompleted = options.hideCompleted ?? false;

  // Whole account, before the scope narrows it. Kept so callers can still show
  // account-wide numbers, and so the scope never hides a row from a mutation.
  const [allAccountTasks, setAllAccountTasks] = useState<Task[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  // Subtasks are kept in one flat list keyed by task id, because they are only
  // ever rendered grouped by task. One query loads every checklist at once.
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  // Daily completion history: one row per task per day. Kept flat and grouped
  // by task on demand, exactly like subtasks.
  const [dailyLogs, setDailyLogs] = useState<TaskDailyLog[]>([]);
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
    const [tasksResult, subtasksResult, dailyLogsResult] = await Promise.all([
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
      supabase
        .from("task_daily_logs")
        .select("*")
        // Oldest first, so a task's chart reads left-to-right as time.
        .order("log_date", { ascending: true }),
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

    if (dailyLogsResult.error) {
      console.error("[DayForge] failed to load daily logs:", dailyLogsResult.error.message);
      setError(dailyLogsResult.error.message);
      setLoading(false);
      return;
    }

    const loadedTasks = (tasksResult.data as Task[]) ?? [];
    setAllAccountTasks(loadedTasks);
    setTasks(loadedTasks);
    setSubtasks((subtasksResult.data as SubTask[]) ?? []);
    setDailyLogs((dailyLogsResult.data as TaskDailyLog[]) ?? []);
    // Clear any previous failure so the banner disappears on a good reload.
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Creates a task and prepends it, so the list updates without a refetch. */
  const createTask = useCallback(
    async (values: TaskInsert) => {
      const supabase = createClient();

      // The Settings preferences arrive in the same payload, because two of
      // them override columns the payload already carries: `category` and
      // `priority` default to Personal/medium in the modal, so "use my
      // default" is only knowable here. They are pulled out before the insert
      // so PostgREST never sees a column that does not exist.
      const { default_category, default_priority, ...columns } = values;
      const payload: TaskInsert = {
        ...columns,
        category:
          columns.category === "Personal" && default_category
            ? default_category
            : columns.category,
        priority:
          columns.priority === "medium" && default_priority
            ? default_priority
            : columns.priority,
      };

      // user_id is omitted on purpose: the column defaults to auth.uid().
      const { data, error } = await supabase
        .from("tasks")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("[DayForge] failed to create task:", error.message);
        throw new Error("Could not save the task. Please try again.");
      }

      setTasks((prev) => [data as Task, ...prev]);
      return data as Task;
    },
    [],
  );

  /**
   * Patches a task. Applied optimistically so the checkbox feels instant, and
   * rolled back if the server rejects it.
   */
  const updateTask = useCallback(async (id: string, values: TaskUpdate) => {
    const supabase = createClient();

    // Settings preferences are a create-time concern only; strip them so a
    // stray field can never turn into an unknown-column error.
    const { default_category: _c, default_priority: _p, ...patch } = values;

    let snapshot: Task | undefined;
    setTasks((prev) => {
      snapshot = prev.find((t) => t.id === id);
      return prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
    });

    // .select() asks PostgREST to return the updated rows, which makes "no row
    // matched" detectable: without it an update that RLS filtered out comes
    // back as a success with zero rows changed, and the UI would show a saved
    // state the database never stored.
    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select("id");

    if (!error && (!data || data.length === 0)) {
      // Zero rows from an update means the WHERE (or RLS) filtered everything
      // out - almost always a stale or missing session, since the id came from
      // a row this user loaded. Logged verbatim so the cause is identifiable.
      console.error(
        `[DayForge] update matched no rows for task ${id}.\n` +
          `  code: none (zero rows returned)\n` +
          `  likely cause: the session has expired or the row is no longer visible to this user (RLS). Try signing in again.`,
      );
      if (snapshot) {
        const previous = snapshot;
        setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
      }
      throw new Error("Could not update the task. Please try again.");
    }

    if (error) {
      // The full Postgres error shape (code/details/hint) goes to the console
      // before the friendly message is thrown, so the real cause is visible.
      logSupabaseError("update task", error);
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

    // Idempotence check before the insert, so the expected "already exists"
    // case never surfaces as a console error. The unique index on
    // (recurrence_source_id, due_at) still runs after this - it is what makes
    // the guarantee hold for two tabs racing - but a plain re-click now takes
    // the cheap path.
    const sourceId = task.recurrence_source_id ?? task.id;
    const { data: existing, error: existingError } = await supabase
      .from("tasks")
      .select("id")
      .eq("recurrence_source_id", sourceId)
      .eq("due_at", nextDueAt)
      .limit(1);

    if (existingError) {
      console.error("[DayForge] failed to check next occurrence:", existingError.message);
      // Fall through to the insert: the unique index is still the real guard.
    } else if (existing && existing.length > 0) {
      return existing[0] as Task;
    }

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
        recurrence_source_id: sourceId,
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
    return data as Task;
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
        // Only the open occurrence of a series creates the next one, so
        // ticking off a task that already has a later occurrence is a plain
        // status change rather than another insert attempt.
        const hasLater = tasks.some(
          (other) =>
            other.id !== task.id &&
            (other.recurrence_source_id ?? null) ===
              (task.recurrence_source_id ?? task.id),
        );
        if (!hasLater) await spawnNextOccurrence(task);
      }
    },
    [updateTask, spawnNextOccurrence, tasks],
  );

  /** Deletes a task, removing it locally only after the server confirms. */
  const deleteTask = useCallback(async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      console.error("[DayForge] failed to delete task:", error.message);
      throw new Error("Could not delete the task. Please try again.");
    }

    // The database cascades the delete to the task's subtasks and daily logs
    // (both FKs are ON DELETE CASCADE), so mirror that locally instead of
    // refetching.
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSubtasks((prev) => prev.filter((s) => s.task_id !== id));
    setDailyLogs((prev) => prev.filter((log) => log.task_id !== id));
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

  // --- Mutations: daily completion logs ------------------------------------

  /**
   * Records today's status for a task: "yes" completed it, "no" did not.
   *
   * Uses an upsert keyed on (task_id, log_date), so submitting again on the same
   * day replaces the row instead of stacking a duplicate - which is what keeps
   * "one status per task per day" true and lets the user correct a mistake.
   *
   * Optimistic: the chart and the percentage update the moment the button is
   * pressed, and roll back if the server rejects the write.
   */
  const submitDailyStatus = useCallback(
    async (task: Task, status: DailyStatus, date: string = todayKey()) => {
      const supabase = createClient();
      const completed = status === "yes";
      const isToday = date === todayKey();

      // Replace any existing row for this task/day so the optimistic state and
      // the upsert agree even when the user flips Yes -> No.
      let previous: TaskDailyLog | undefined;
      setDailyLogs((prev) => {
        previous = prev.find((log) => log.task_id === task.id && log.log_date === date);
        const withoutToday = prev.filter(
          (log) => !(log.task_id === task.id && log.log_date === date),
        );
        const optimistic: TaskDailyLog = {
          id: previous?.id ?? `optimistic-${task.id}-${date}`,
          user_id: previous?.user_id ?? task.user_id,
          task_id: task.id,
          log_date: date,
          completed,
          created_at: previous?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return [...withoutToday, optimistic];
      });

      // Update-then-insert instead of a single ON CONFLICT upsert. The upsert
      // requires a unique index on (task_id, log_date); if that index has not
      // been applied to the live database yet, Postgres rejects the whole
      // statement at plan time with SQLSTATE 42P10 - which made every Yes/No
      // click fail with "Could not save today's status". Reading first and
      // choosing UPDATE or INSERT does not depend on the index, so it works
      // either way (once the index exists, it still guarantees one row per
      // task/day against racing tabs).
      const { data: existingRow, error: readError } = await supabase
        .from("task_daily_logs")
        .select("id")
        .eq("task_id", task.id)
        .eq("log_date", date)
        .limit(1)
        .maybeSingle();

      const write = existingRow
        ? supabase
            .from("task_daily_logs")
            .update({ completed })
            .eq("id", existingRow.id)
            .select()
            .single()
        : supabase
            .from("task_daily_logs")
            .insert({ task_id: task.id, log_date: date, completed, user_id: task.user_id })
            .select()
            .single();

      const { data, error } = await write;

      if (readError) {
        logSupabaseError("submit daily status (read)", readError);
      }

      // Swap the optimistic row for the real one the server returned, then
      // settle the task itself (shared by the race-retry path below).
      const finish = async (savedRow: TaskDailyLog) => {
        const saved = savedRow;
        setDailyLogs((prev) => [
          ...prev.filter((log) => !(log.task_id === task.id && log.log_date === date)),
          saved,
        ]);

        if (isToday && completed && task.status !== "done") {
          await updateTask(task.id, { status: "done" });

          if (isRecurring(task)) {
            const hasLater = tasks.some(
              (other) =>
                other.id !== task.id &&
                (other.recurrence_source_id ?? null) ===
                  (task.recurrence_source_id ?? task.id),
            );
            if (!hasLater) await spawnNextOccurrence(task);
          }
        }

        return saved;
      };

      if (error) {
        // 23505 = unique_violation. With the (task_id, log_date) index in
        // place, this is what two tabs racing to insert the same task/day
        // looks like: the row exists, so retry it as an UPDATE instead of
        // surfacing a failure.
        if (isUniqueViolation(error) && !existingRow) {
          const retry = await supabase
            .from("task_daily_logs")
            .update({ completed })
            .eq("task_id", task.id)
            .eq("log_date", date)
            .select()
            .single();
          if (!retry.error) {
            return finish(retry.data as TaskDailyLog);
          }
        }
        // 23503 = foreign_key_violation. If the live schema lacks the
        // (id, user_id) unique constraint the composite FK needs, inserting
        // with an explicit user_id fails while the trigger-stamped path
        // would not. Retry once without the column so the write still lands.
        if ((error as { code?: string }).code === "23503" && !existingRow) {
          const retry = await supabase
            .from("task_daily_logs")
            .insert({ task_id: task.id, log_date: date, completed })
            .select()
            .single();
          if (!retry.error) {
            return finish(retry.data as TaskDailyLog);
          }
        }
        // The full Postgres error shape goes to the console first: for the
        // write this is where 42501 (an RLS rejection) or 23505 (a duplicate
        // insert racing another tab, once the unique index exists) shows up
        // verbatim.
        logSupabaseError("submit daily status", error);
        // Roll back to exactly what the server still holds.
        setDailyLogs((prev) => {
          const withoutToday = prev.filter(
            (log) => !(log.task_id === task.id && log.log_date === date),
          );
          return previous ? [...withoutToday, previous] : withoutToday;
        });
        throw new Error("Could not save today's status. Please try again.");
      }

      // Swap the optimistic row for the real one the server returned.
      return finish(data as TaskDailyLog);
    },
    [spawnNextOccurrence, tasks, updateTask],
  );

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

  // --- Derived daily-completion state --------------------------------------

  // Daily logs grouped by task, oldest first (the fetch already ordered them).
  const dailyLogsByTask = useMemo(() => {
    const map = new Map<string, TaskDailyLog[]>();
    for (const log of dailyLogs) {
      const list = map.get(log.task_id);
      if (list) list.push(log);
      else map.set(log.task_id, [log]);
    }
    return map;
  }, [dailyLogs]);

  /**
   * Today's status per task, keyed by task id. A task with no entry has not
   * been answered yet today, which is exactly what the Today panel needs.
   */
  const todayStatusByTask = useMemo(() => {
    const today = todayKey();
    const map = new Map<string, DailyStatus>();
    for (const log of dailyLogs) {
      if (log.log_date === today) map.set(log.task_id, log.completed ? "yes" : "no");
    }
    return map;
  }, [dailyLogs]);

  /**
   * The daily figures the Dashboard shows: one value per calendar day, built
   * only from the eligible tasks in scope.
   *
   *   total   = tasks eligible that day
   *   yes     = eligible tasks marked "Yes" that day
   *   percent = yes / (yes + no), and null when nothing was answered
   *
   * The denominator is the ANSWERED set, not the eligible set, on purpose: a
   * day the user has not reached yet, or one where nothing was eligible, must
   * not be reported as a failure. A day with eligible tasks but no answers is a
   * real gap, so it is reported with total > 0 and yes + no === 0.
   */
  /**
   * Per-task history and consistency numbers, for the progress charts.
   * Built from the same flat log list, so a card, the dashboard chart and the
   * headline tiles can never disagree about a percentage.
   */
  const progressByTask = useMemo(() => {
    const map = new Map<string, TaskProgress>();
    for (const task of tasks) {
      const logs = dailyLogsByTask.get(task.id) ?? [];
      map.set(task.id, buildProgress(task, logs));
    }
    return map;
  }, [tasks, dailyLogsByTask]);

  /**
   * Recurring tasks roll up into one row per series.
   *
   * Completing a weekly lecture creates next week's occurrence, so without this
   * every occurrence would appear as its own task and today's percentage would
   * be diluted by rows about other weeks. The OPEN occurrence represents the
   * series (that is the one you can act on); if the whole series is finished,
   * the newest occurrence stands in, so the history and the charts still have a
   * row to hang off. Nothing is merged in the database - this is a read-time
   * view, so no history is ever lost.
   */
  const seriesTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();
    const singles: Task[] = [];

    for (const task of tasks) {
      const key = task.recurrence_source_id;
      if (!key) {
        singles.push(task);
        continue;
      }
      const group = groups.get(key);
      if (group) group.push(task);
      else groups.set(key, [task]);
    }

    const representatives = Array.from(groups.values()).map((group) => {
      const open = group
        .filter((task) => task.status !== "done")
        .sort((a, b) => dueRank(a) - dueRank(b));
      if (open.length > 0) return open[0];
      return [...group].sort((a, b) => dueRank(b) - dueRank(a))[0];
    });

    return [...singles, ...representatives].sort(comparator(sort));
  }, [tasks, sort]);

  const seriesIds = useMemo(
    () => new Set(seriesTasks.map((task) => task.id)),
    [seriesTasks],
  );

  /**
   * Today's answer for every task, already shaped for the panel: answered ones
   * keep their "yes"/"no", unanswered ones are null.
   */
  /**
   * A task's history, widened to cover every occurrence of the same series.
   *
   * `buildProgress` reads one task id, but a series' history is spread across
   * its occurrences: a weekly task completed last week has its log on last
   * week's row. Merging here is what lets the chart and the percentage show the
   * real streak across occurrences instead of only ever counting the newest one.
   */
  const historyForTask = useCallback(
    (task: Task) => {
      const sourceId = task.recurrence_source_id;
      if (!sourceId) return dailyLogsByTask.get(task.id) ?? [];

      const merged: TaskDailyLog[] = [];
      const seenDates = new Set<string>();

      for (const candidate of tasks) {
        if (candidate.id !== sourceId && candidate.recurrence_source_id !== sourceId) {
          continue;
        }
        for (const log of dailyLogsByTask.get(candidate.id) ?? []) {
          // Ascending order means the earliest row for a date is kept, so a
          // duplicated date can never be double-counted.
          if (seenDates.has(log.log_date)) continue;
          seenDates.add(log.log_date);
          merged.push(log);
        }
      }

      for (const log of dailyLogsByTask.get(task.id) ?? []) {
        if (seenDates.has(log.log_date)) continue;
        seenDates.add(log.log_date);
        merged.push(log);
      }

      return merged.sort((a, b) => a.log_date.localeCompare(b.log_date));
    },
    [tasks, dailyLogsByTask],
  );

  /**
   * Today's answer for a recurring task is answered on whichever occurrence of
   * the series was already logged today - typically the previous occurrence,
   * because that is the row the shared Yes/No button writes to.
   */
  const seriesMemberIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const task of tasks) {
      if (!task.recurrence_source_id) continue;
      const list = map.get(task.recurrence_source_id);
      if (list) list.push(task.id);
      else map.set(task.recurrence_source_id, [task.id]);
    }
    return map;
  }, [tasks]);

  const todayProgress = useMemo<TodayTaskProgress[]>(
    () =>
      seriesTasks.map((task) => {
        const logs = historyForTask(task);
        const base = buildProgress(task, logs);

        let today = todayStatusByTask.get(task.id) ?? null;
        if (today === null && task.recurrence_source_id) {
          for (const memberId of seriesMemberIds.get(task.recurrence_source_id) ?? []) {
            const memberToday = todayStatusByTask.get(memberId);
            if (memberToday) {
              today = memberToday;
              break;
            }
          }
        }

        return { ...base, today };
      }),
    [seriesTasks, seriesMemberIds, historyForTask, todayStatusByTask],
  );

  /** Every category in use, for the category filter dropdown. */
  // Scoped to the visible list, so a course-labelled category never appears in
  // the dropdown of a home-scoped page.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) set.add(task.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  /** The tasks eligible for the daily question, in scope: the percentage base. */
  const eligible = useMemo(
    () => tasks.filter(isTaskEligibleToday),
    [tasks],
  );

  /**
   * The list once search, filters and sort are applied, but BEFORE the tab is
   * applied. This is what the tab counts are derived from, which is what keeps
   * the counts and the visible rows telling the same story.
   */
  const searched = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();

    // Scope first, then search/filter/sort. Applying it here (rather than only
    // when rendering) is what keeps the tab counts and the empty states honest.
    const matched = tasksInScope(tasks, scope).filter((task) => {
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
  }, [tasks, scope, debouncedSearch, priority, category, status, sort]);

  /**
   * The daily figures the Dashboard shows: one value per calendar day, built
   * only from the eligible tasks in scope.
   *
   *   total   = tasks eligible that day
   *   yes     = eligible tasks marked "Yes" that day
   *   percent = yes / (yes + no), and null when nothing was answered
   *
   * The denominator is the ANSWERED set, not the eligible set, on purpose: a
   * day the user has not reached yet, or one where nothing was eligible, must
   * not be reported as a failure. A day with eligible tasks but no answers is a
   * real gap, so it is reported with total > 0 and yes + no === 0.
   */
  const dailyStats = useMemo(() => {
    const days = recentDayKeys(DAILY_STATS_DAYS);

    // Resolved once per task rather than once per task per day: the window is
    // three weeks, and resolving inside the loop below would re-walk a series
    // for every date it appears on.
    const historyByTask = eligible.map((task) => historyForTask(task));

    const points = days.map((date) => {
      let total = 0;
      let yes = 0;
      let no = 0;

      eligible.forEach((task, index) => {
        // A task is only eligible from the day it was due (or today, when it
        // has no due date). Counting it on earlier days would invent history.
        if (task.due_at) {
          const due = new Date(task.due_at);
          if (!Number.isNaN(due.getTime()) && todayKey(due) > date) return;
        }

        total += 1;

        const log = historyByTask[index].find((entry) => entry.log_date === date);
        if (!log) return;
        if (log.completed) yes += 1;
        else no += 1;
      });

      const answered = yes + no;
      return {
        date,
        total,
        yes,
        no,
        answered,
        percent: answered === 0 ? null : Math.round((yes / answered) * 100),
      };
    });

    const today = points[points.length - 1];
    const answeredPoints = points.filter((point) => point.answered > 0);
    const answeredYes = answeredPoints.reduce((sum, point) => sum + point.yes, 0);
    const answeredNo = answeredPoints.reduce((sum, point) => sum + point.no, 0);

    return {
      points,
      today,
      /** Eligible tasks in scope right now. */
      eligibleOpen: eligible.length,
      /** Days with eligible tasks but no answer at all - gaps, not failures. */
      unansweredDays: points.filter((point) => point.total > 0 && point.answered === 0)
        .length,
      /** Percentage across every answered day in the window. */
      windowPercent:
        answeredYes + answeredNo === 0
          ? null
          : Math.round((answeredYes / (answeredYes + answeredNo)) * 100),
      windowAnsweredDays: answeredPoints.length,
    };
  }, [eligible, historyForTask]);

  // The list with recurring series collapsed to one row each, so a weekly task
  // does not appear once per week it has ever occurred.
  const rolledUp = useMemo(
    () => searched.filter((task) => seriesIds.has(task.id)),
    [searched, seriesIds],
  );

  /**
   * Applies the user's "show completed tasks" preference to the list.
   *
   * An explicit status filter ("done", or any other) means the user has said
   * what they want to see right now, so the preference stands aside rather than
   * silently hiding rows they just asked for.
   */
  const afterPreferences = useMemo(
    () =>
      hideCompleted && status === ALL_STATUSES
        ? rolledUp.filter((task) => task.status !== "done")
        : rolledUp,
    [rolledUp, hideCompleted, status],
  );

  // The visible list for the active tab.
  const filteredTasks = useMemo(
    () => afterPreferences.filter((task) => matchesFilter(task, filter)),
    [afterPreferences, filter],
  );

  // Counts per tab, over the searched/filtered set, so they add up to what the
  // user can actually see.
  const counts = useMemo(
    () => ({
      today: afterPreferences.filter((t) => matchesFilter(t, "today")).length,
      upcoming: afterPreferences.filter((t) => matchesFilter(t, "upcoming")).length,
      overdue: afterPreferences.filter((t) => matchesFilter(t, "overdue")).length,
      all: afterPreferences.length,
    }),
    [afterPreferences],
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
    // `tasks` is the visible list: the scope first, recurring series collapsed,
    // then the tab, then the toolbar. Everything derived below is built from the
    // same set, so the list, the tabs, the counts and the charts always agree.
    tasks: filteredTasks,
    allTasks: tasksInScope(tasks, scope),
    accountTasks: allAccountTasks,
    subtasksByTask,
    counts,
    categories,
    loading,
    error,

    // Daily completion
    dailyLogsByTask,
    todayStatusByTask,
    progressByTask,
    todayProgress,
    dailyStats,
    seriesTasks,
    seriesIds,
    historyForTask,
    eligibleTasks: eligible,
    scopeTasks: tasksInScope(allAccountTasks, scope),
    submitDailyStatus,

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
    hideCompleted,

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

// ---------------------------------------------------------------------------
// Daily completion helpers
// ---------------------------------------------------------------------------

/**
 * Today's calendar day as YYYY-MM-DD, in the BROWSER's timezone.
 *
 * Built from local parts on purpose: `toISOString()` would give the UTC day,
 * which is a different calendar day for anyone west of Greenwich in the
 * evening. The stored `log_date` must match the day the user thinks it is.
 */
export function todayKey(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Turns a flat list of a task's logs into the chart history and the derived
 * consistency numbers. Pure, so the hook's memos and any test can reuse it.
 *
 * `completionRate` is completedDays / trackedDays - a missed day lowers the
 * percentage, an unanswered day does not count at all. That is what makes the
 * number "how often I did it when I tracked it", not "how many days exist".
 */
export function buildProgress(task: Task, logs: TaskDailyLog[]): TaskProgress {
  const history: DailyPoint[] = logs.map((log) => ({
    date: log.log_date,
    completed: log.completed,
  }));

  const completedDays = history.filter((point) => point.completed).length;
  const trackedDays = history.length;
  const completionRate = trackedDays === 0 ? 0 : Math.round((completedDays / trackedDays) * 100);

  return { task, history, completedDays, trackedDays, completionRate };
}

/**
 * The last `days` calendar days, oldest first, as YYYY-MM-DD keys. Used to give
 * the chart a fixed, gap-free x-axis so a missed day is a red bar rather than
 * a missing one.
 */
export function recentDayKeys(days: number, endDate: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - offset);
    keys.push(todayKey(d));
  }
  return keys;
}

/**
 * Lines a task's history up with a fixed window of days (oldest first).
 * A day with no log comes back as null, so the chart can render it as "not
 * answered" instead of pretending it was a miss.
 */
export function alignHistoryToDays(
  history: DailyPoint[],
  dayKeys: string[],
): (DailyPoint | null)[] {
  const byDate = new Map(history.map((point) => [point.date, point]));
  return dayKeys.map((date) => byDate.get(date) ?? null);
}
