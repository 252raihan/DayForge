"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import ConfirmDeleteModal from "@/components/tasks/ConfirmDeleteModal";
import { PriorityBadge } from "@/components/tasks/task-utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorBanner,
  ProgressBar,
  Select,
  SegmentedControl,
} from "@/components/ui";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { useTasks, matchesFilter, todayKey } from "@/hooks/useTasks";
import { useResolvedPreferences } from "@/lib/preferences";
import { HOME_SCOPE } from "@/lib/home-scope";
import { formatLongDay, formatShortDay, formatTimeOfDay, monthGrid, shiftDays, shiftMonth, taskDayKey, weekGrid } from "@/lib/calendar-utils";
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
      <PageHeader
        title="Calendar"
        description="Your tasks by due date. Complete, edit or add them straight from the day you are looking at."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              ariaLabel="Calendar view"
              value={view}
              onChange={setView}
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
              ]}
            />

            <Button
              variant="secondary"
              onClick={() => {
                setAnchor(today);
                setSelectedDate(today);
              }}
            >
              Today
            </Button>

            <div className="flex items-center rounded-lg border border-border bg-surface shadow-xs">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(-1)}
                aria-label={view === "month" ? "Previous month" : "Previous week"}
                className="rounded-r-none"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <span className="min-w-[8.5rem] border-x border-border px-1 text-center text-xs font-semibold tabular-nums text-fg">
                {rangeLabel}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(1)}
                aria-label={view === "month" ? "Next month" : "Next week"}
                className="rounded-l-none"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <Alert onDismiss={() => setActionError(null)}>{actionError}</Alert>
        </div>
      ) : null}

      {/* Filters. They narrow every cell and the day panel together. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskFilter)}
          className="w-auto"
        >
          <option value="all">All statuses</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
        </Select>

        <Select
          aria-label="Filter by priority"
          value={priorityFilter ?? ""}
          onChange={(e) => setPriorityFilter((e.target.value || null) as TaskPriority | null)}
          className="w-auto"
        >
          <option value="">Any priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>

        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-auto"
        >
          <option value="__all__">Any category</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>

        <Button
          variant="secondary"
          active={hideCompleted}
          aria-pressed={hideCompleted}
          onClick={() => {
            setHideCompletedTouched(true);
            setHideCompleted((prev) => !prev);
          }}
        >
          Hide completed
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
        {/* The grid */}
        <Card padded={false} className={loading ? "opacity-60" : ""}>
          <div
            className={`grid gap-px overflow-hidden rounded-xl bg-border ${
              view === "month" ? "grid-cols-7" : "grid-cols-1 sm:grid-cols-7"
            }`}
          >
            {grid.weekdayLabels.map((label) => (
              <div
                key={label}
                className="bg-surface-2 px-2 py-2 text-center text-3xs font-semibold uppercase tracking-[0.08em] text-muted"
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
                  className={`min-h-[4.5rem] bg-surface px-1.5 py-1.5 text-left align-top transition-colors sm:min-h-[6.5rem] sm:px-2 sm:py-2 ${
                    day.inMonth ? "" : "opacity-45"
                  } ${
                    isSelected
                      ? "bg-accent-soft/70 ring-1 ring-inset ring-accent/50"
                      : "hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                        isToday
                          ? "bg-accent text-white"
                          : isSelected
                            ? "text-accent"
                            : day.inMonth
                              ? "text-fg"
                              : "text-muted"
                      }`}
                    >
                      {Number(day.date.slice(-2))}
                    </span>
                    {dayTasks.length > 0 ? (
                      <span className="text-3xs font-medium tabular-nums text-muted">
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
                      // A left dot carries the state, so the chip itself can stay
                      // a quiet tint instead of a saturated block of colour.
                      const dot = done
                        ? "bg-emerald-500"
                        : overdue
                          ? "bg-red-500"
                          : task.priority === "high"
                            ? "bg-amber-500"
                            : "bg-accent";
                      return (
                        <span
                          key={task.id}
                          title={task.title}
                          className={`flex items-center gap-1 truncate rounded-[4px] px-1 py-0.5 text-[10px] leading-[1.35] ${
                            done
                              ? "bg-surface-2 text-muted line-through"
                              : "bg-surface-2/80 text-fg"
                          }`}
                        >
                          <span className={`h-1 w-1 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                          <span className="truncate">{task.title}</span>
                        </span>
                      );
                    })}
                    {view === "month" && dayTasks.length > 2 ? (
                      <span className="block px-1 text-3xs text-muted">
                        +{dayTasks.length - 2} more
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-surface px-3 py-2 text-3xs text-muted">
            <LegendDot className="bg-emerald-500" label="Completed" />
            <LegendDot className="bg-red-500" label="Overdue" />
            <LegendDot className="bg-amber-500" label="High priority" />
            <LegendDot className="bg-accent" label="Planned" />
            <span>Counts are done / total</span>
          </p>
        </Card>

        {/* The selected day */}
        <Card className="xl:sticky xl:top-20">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-[0.08em] text-muted">
                {selectedDate === today ? "Today" : "Selected day"}
              </p>
              <h2 className="mt-0.5 text-sm font-semibold tracking-tight text-fg">
                {formatLongDay(selectedDate)}
              </h2>
              <p className="mt-0.5 text-2xs text-muted">
                {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"} due
                {selectedTasks.length > 0
                  ? ` · ${selectedTasks.filter((t) => t.status === "done").length} done`
                  : ""}
              </p>
            </div>

            {view === "week" ? (
              <Badge tone="neutral">
                Week of {formatShortDay(orderedDays[0]?.date ?? anchor)}
              </Badge>
            ) : null}
          </div>

          {selectedTasks.length > 0 ? (
            <ProgressBar
              value={selectedTasks.filter((t) => t.status === "done").length}
              max={selectedTasks.length}
              label="Tasks completed on this day"
              className="mb-3"
            />
          ) : null}

          <Button fullWidth onClick={() => openAdd(selectedDate)} className="mb-3">
            <PlusIcon className="h-4 w-4" strokeWidth={2} />
            Add task
          </Button>

          {selectedTasks.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<CalendarIcon className="h-5 w-5" />}
              title={`Nothing due ${formatShortDay(selectedDate)}`}
              hint={
                (statusFilter !== "all" || priorityFilter || categoryFilter !== "__all__") &&
                filtered.length === 0 &&
                accountTasks.length > 0
                  ? "Your filters may be hiding some tasks for this day."
                  : "This day is clear. Add something, or pick another date."
              }
            />
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((task) => {
                const done = task.status === "done";
                const todayStatus = todayStatusByTask.get(task.id) ?? null;
                const isTodayRow = taskDayKey(task) === today;
                const checklist = subtasksByTask.get(task.id) ?? [];
                const checklistDone = checklist.filter((s) => s.done).length;
                return (
                  <li
                    key={task.id}
                    className={`rounded-lg border border-border bg-surface p-3 shadow-xs ${
                      busyIds.includes(task.id) ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        checked={done}
                        disabled={busyIds.includes(task.id)}
                        onChange={() => handleToggle(task)}
                        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p
                            className={`min-w-0 break-words text-[13px] font-medium leading-relaxed ${
                              done ? "text-muted line-through" : "text-fg"
                            }`}
                          >
                            {task.title}
                          </p>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-2xs text-muted">
                          <span>{task.due_at ? formatTimeOfDay(task.due_at) : "No time set"}</span>
                          <span className="text-muted/60" aria-hidden="true">·</span>
                          <span className="truncate">{task.category}</span>
                          {checklist.length > 0 ? (
                            <>
                              <span className="text-muted/60" aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {checklistDone}/{checklist.length} checklist
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {/* The date-specific answer, only offered for today: a
                        daily log describes today, so that is the only day it
                        can honestly be recorded for. */}
                    {isTodayRow ? (
                      <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/70 pt-2.5">
                        <span className="mr-0.5 text-2xs text-muted">Today:</span>
                        <Button
                          variant="success"
                          size="sm"
                          active={todayStatus === "yes"}
                          disabled={busyIds.includes(task.id)}
                          aria-pressed={todayStatus === "yes"}
                          onClick={() => handleDaily(task, "yes")}
                          className="h-7 min-w-12 px-2"
                        >
                          Yes
                        </Button>
                        <Button
                          variant="dangerSubtle"
                          size="sm"
                          active={todayStatus === "no"}
                          disabled={busyIds.includes(task.id)}
                          aria-pressed={todayStatus === "no"}
                          onClick={() => handleDaily(task, "no")}
                          className="h-7 min-w-12 px-2"
                        >
                          No
                        </Button>
                      </div>
                    ) : null}

                    <div className="mt-1.5 -mb-1 flex items-center justify-end gap-0.5">
                      {checklist.length > 0 ? (
                        <Badge tone="neutral" className="mr-auto border-transparent bg-transparent px-1">
                          {checklistDone}/{checklist.length} checklist
                        </Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(task)}
                        aria-label={`Edit "${task.title}"`}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(task)}
                        aria-label={`Delete "${task.title}"`}
                        className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
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

/** Legend dot + word, so the grid's colour language is documented on the page. */
function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}



