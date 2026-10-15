"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import ConfirmDeleteModal from "@/components/tasks/ConfirmDeleteModal";
import { ErrorBanner } from "@/components/ui";
import { useTasks, matchesFilter, todayKey } from "@/hooks/useTasks";
import { useResolvedPreferences } from "@/lib/preferences";
import { HOME_SCOPE } from "@/lib/home-scope";
import {
  formatLongDay,
  formatShortDay,
  formatTimeOfDay,
  monthGrid,
  shiftDays,
  shiftMonth,
  taskDayKey,
  weekGrid,
} from "@/lib/calendar-utils";
import type {
  DailyStatus,
  Task,
  TaskFilter,
  TaskInsert,
  TaskPriority,
} from "@/types";

// Calendar: month and week views over the SAME task rows the Tasks page uses.
//
// There is no separate calendar database and no second completion state. A day
// cell counts tasks by their due date; the day panel lists them and can edit,
// delete, complete (status) or answer the daily Yes/No - all through the shared
// useTasks hook, so a change here shows up on /tasks and the dashboard too.

type ViewMode = "month" | "week";

export default function CalendarPage() {
  const {
    accountTasks,
    loading,
    error,
    reload,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    submitDailyStatus,
    todayStatusByTask,
    dailyLogsByTask,
    subtasksByTask,
  } = useTasks(HOME_SCOPE);

  const { preferences } = useResolvedPreferences();
  const weekStart = preferences.week_start;

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => todayKey());
  const [selectedDate, setSelectedDate] = useState(() => todayKey());
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  // Seeded from the saved preference, but overridable for this visit.
  const [hideCompleted, setHideCompleted] = useState(false);
  const [hideCompletedTouched, setHideCompletedTouched] = useState(false);

  useEffect(() => {
    if (hideCompletedTouched) return;
    setHideCompleted(!preferences.show_completed_tasks);
  }, [preferences.show_completed_tasks, hideCompletedTouched]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  function markBusy(id: string, busy: boolean) {
    setBusyIds((prev) => (busy ? [...prev, id] : prev.filter((value) => value !== id)));
  }

  // Which tasks pass the toolbar. Applied to every day cell so the counts and
  // the panel always agree about what is being shown.
  const filtered = useMemo(() => {
    return accountTasks.filter((task) => {
      if (!matchesFilter(task, statusFilter)) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (categoryFilter !== "__all__" && task.category !== categoryFilter) return false;
      if (hideCompleted && task.status === "done") return false;
      return true;
    });
  }, [accountTasks, statusFilter, priorityFilter, categoryFilter, hideCompleted]);

  // Days to render, plus the navigation range for both views.
  const grid = useMemo(() => (view === "month" ? monthGrid(anchor, weekStart) : weekGrid(anchor, weekStart)), [view, anchor, weekStart]);
  const orderedDays = useMemo(
    () => [...grid.days].sort((a, b) => a.date.localeCompare(b.date)),
    [grid],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const task of accountTasks) set.add(task.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [accountTasks]);

  function navigate(step: number) {
    setAnchor((current) =>
      view === "month" ? shiftMonth(current, step) : shiftDays(current, step * 7),
    );
  }

  function openAdd(date: string) {
    setEditing(null);
    setFormDate(date);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setFormDate(null);
    setFormOpen(true);
  }

  async function handleSubmit(values: TaskInsert) {
    if (editing) await updateTask(editing.id, values);
    else await createTask(values);
  }

  async function handleToggle(task: Task) {
    markBusy(task.id, true);
    setActionError(null);
    try {
      await toggleTask(task);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the task.");
    } finally {
      markBusy(task.id, false);
    }
  }

  async function handleDaily(task: Task, status: DailyStatus) {
    markBusy(task.id, true);
    setActionError(null);
    try {
      await submitDailyStatus(task, status);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not save today's status.",
      );
    } finally {
      markBusy(task.id, false);
    }
  }

  async function handleDelete(task: Task) {
    markBusy(task.id, true);
    setActionError(null);
    try {
      await deleteTask(task.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete the task.");
      throw err;
    } finally {
      markBusy(task.id, false);
    }
  }

  const selectedTasks = filtered
    .filter((task) => taskDayKey(task) === selectedDate)
    .sort(byTimeThenPriority);

  const today = todayKey();
  const rangeLabel = grid.label;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Calendar"
          description="Your tasks by due date. Complete, edit or add them straight from the day you are looking at."
        />

        <div className="flex items-center gap-2">
          {/* Mon / Sun order follows the saved preference. */}
          <div className="flex rounded-xl border border-border p-0.5">
            {(["month", "week"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === mode
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:text-accent"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setAnchor(today);
              setSelectedDate(today);
            }}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl border border-border">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={view === "month" ? "Previous month" : "Previous week"}
              className="rounded-l-xl px-2.5 py-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <Chevron direction="left" />
            </button>
            <span className="min-w-[9.5rem] px-1 text-center text-xs font-semibold">
              {rangeLabel}
            </span>
            <button
              type="button"
              onClick={() => navigate(1)}
              aria-label={view === "month" ? "Next month" : "Next week"}
              className="rounded-r-xl px-2.5 py-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <Chevron direction="right" />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      {/* Filters. They narrow every cell and the day panel together. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskFilter)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="all">All statuses</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
        </select>

        <select
          aria-label="Filter by priority"
          value={priorityFilter ?? ""}
          onChange={(e) => setPriorityFilter((e.target.value || null) as TaskPriority | null)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Any priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="__all__">Any category</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={hideCompleted}
          onClick={() => {
            setHideCompletedTouched(true);
            setHideCompleted((prev) => !prev);
          }}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            hideCompleted
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-muted hover:bg-accent-soft/60 hover:text-accent"
          }`}
        >
          Hide completed
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem] xl:items-start">
        {/* The grid */}
        <section className={loading ? "opacity-60" : ""}>
          <div
            className={`grid gap-px overflow-hidden rounded-2xl border border-border bg-border ${
              view === "month" ? "grid-cols-7" : "grid-cols-1 sm:grid-cols-7"
            }`}
          >
            {grid.weekdayLabels.map((label) => (
              <div
                key={label}
                className="bg-surface px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted"
              >
                {view === "week" ? label : label.slice(0, 3)}
              </div>
            ))}

            {grid.days.map((day) => {
              const dayTasks = filtered.filter((task) => taskDayKey(task) === day.date);
              const doneCount = dayTasks.filter((task) => isTaskDone(task, day.date, todayStatusByTask, dailyLogsByTask)).length;
              const isSelected = day.date === selectedDate;
              const isToday = day.date === today;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  className={`min-h-[5.5rem] bg-surface px-2 py-2 text-left align-top transition-colors sm:min-h-[6.5rem] ${
                    day.inMonth ? "" : "opacity-50"
                  } ${isSelected ? "ring-2 ring-inset ring-accent" : "hover:bg-accent-soft/30"}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                        isToday ? "bg-accent text-white" : "text-muted"
                      }`}
                    >
                      {Number(day.date.slice(-2))}
                    </span>
                    {dayTasks.length > 0 ? (
                      <span className="text-[10px] font-medium text-muted">
                        {doneCount}/{dayTasks.length}
                      </span>
                    ) : null}
                  </div>

                  {/* Up to two task chips, then a count. Keeps cells readable on
                      a phone without hiding that more exist. */}
                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, view === "week" ? 99 : 2).map((task) => {
                      const done = isTaskDone(task, day.date, todayStatusByTask, dailyLogsByTask);
                      const overdue = !done && taskDayKey(task) < today;
                      return (
                        <span
                          key={task.id}
                          title={task.title}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${
                            done
                              ? "bg-emerald-100 text-emerald-700 line-through dark:bg-emerald-950 dark:text-emerald-300"
                              : overdue
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : task.priority === "high"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-accent-soft text-accent"
                          }`}
                        >
                          {task.title}
                        </span>
                      );
                    })}
                    {view === "month" && dayTasks.length > 2 ? (
                      <span className="block px-1.5 text-[10px] text-muted">
                        +{dayTasks.length - 2} more
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-muted">
            <span className="mr-3">Green = completed</span>
            <span className="mr-3">Red = overdue</span>
            <span className="mr-3">Amber = high priority</span>
            <span>Counts show done / total for that day</span>
          </p>
        </section>

        {/* The selected day */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {formatLongDay(selectedDate)}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"} due
              </p>
            </div>

            {view === "week" ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                Week of {formatShortDay(orderedDays[0]?.date ?? anchor)}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => openAdd(selectedDate)}
            className="mb-3 w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Add task on this date
          </button>

          {selectedTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3.5 py-6 text-center text-xs text-muted">
              No tasks due on {formatShortDay(selectedDate)}.
              {(statusFilter !== "all" || priorityFilter || categoryFilter !== "__all__") &&
              filtered.length === 0 &&
              accountTasks.length > 0
                ? " Your filters may be hiding some."
                : ""}
            </p>
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((task) => {
                const done = task.status === "done";
                const todayStatus = todayStatusByTask.get(task.id) ?? null;
                const isTodayRow = taskDayKey(task) === today;
                return (
                  <li
                    key={task.id}
                    className={`rounded-xl border border-border bg-app p-3 ${
                      busyIds.includes(task.id) ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={busyIds.includes(task.id)}
                        onChange={() => handleToggle(task)}
                        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                        style={{ height: "1.125rem", width: "1.125rem" }}
                        className="mt-0.5 shrink-0 cursor-pointer rounded border-border accent-[rgb(var(--accent))]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${done ? "text-muted line-through" : ""}`}>
                          {task.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {task.due_at ? formatTimeOfDay(task.due_at) : "No time set"} · {task.category} · {task.priority}
                        </p>
                      </div>
                    </div>

                    {/* The date-specific answer, only offered for today: a
                        daily log describes today, so that is the only day it
                        can honestly be recorded for. */}
                    {isTodayRow ? (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[11px] text-muted">Today:</span>
                        <button
                          type="button"
                          disabled={busyIds.includes(task.id)}
                          aria-pressed={todayStatus === "yes"}
                          onClick={() => handleDaily(task, "yes")}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                            todayStatus === "yes"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          disabled={busyIds.includes(task.id)}
                          aria-pressed={todayStatus === "no"}
                          onClick={() => handleDaily(task, "no")}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                            todayStatus === "no"
                              ? "border-red-500 bg-red-500 text-white"
                              : "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => openEdit(task)}
                        className="font-semibold text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(task)}
                        className="font-semibold text-red-700 hover:underline dark:text-red-300"
                      >
                        Delete
                      </button>
                      {(subtasksByTask.get(task.id)?.length ?? 0) > 0 ? (
                        <span className="text-muted">
                          {subtasksByTask.get(task.id)?.filter((s) => s.done).length}/{
                            subtasksByTask.get(task.id)?.length
                          } checklist
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <TaskFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        task={editing}
        defaults={{
          category: preferences.default_category,
          priority: preferences.default_priority,
          onDate: formDate,
        }}
      />

      <ConfirmDeleteModal
        task={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        consequences={[]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Task helpers
// ---------------------------------------------------------------------------

/**
 * Whether a task counts as done on a given day: the daily log for that day if
 * one exists, otherwise the task's own status.
 *
 * Both sources are real persisted data - the log is the per-day answer, the
 * status is the task's overall state - and preferring the log is what makes a
 * task completed on Monday, missed on Tuesday and done again on Wednesday
 * render as three different days.
 */
function isTaskDone(
  task: Task,
  date: string,
  todayStatus: Map<string, DailyStatus>,
  dailyLogs: Map<string, { log_date: string; completed: boolean }[]>,
): boolean {
  const log = (dailyLogs.get(task.id) ?? []).find((entry) => entry.log_date === date);
  if (log) return log.completed;
  if (date === todayKey() && todayStatus.has(task.id)) return todayStatus.get(task.id) === "yes";
  return task.status === "done";
}

/** Soonest time first; tasks without a time go last, then by priority. */
function byTimeThenPriority(a: Task, b: Task): number {
  const aTime = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return rank[a.priority] - rank[b.priority];
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/** Chevron for the month/week navigation buttons. */
function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

