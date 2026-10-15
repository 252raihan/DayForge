"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components";
import { EmptyState, ErrorBanner, LoadingRows } from "@/components/ui";
import TaskTabs from "@/components/tasks/TaskTabs";
import TaskToolbar from "@/components/tasks/TaskToolbar";
import TaskCard from "@/components/tasks/TaskCard";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import ConfirmDeleteModal from "@/components/tasks/ConfirmDeleteModal";
import { formatDueDate } from "@/components/tasks/task-utils";
import { useTasks, matchesFilter, ALL_STATUSES } from "@/hooks/useTasks";
import { useResolvedPreferences } from "@/lib/preferences";
import { HOME_SCOPE } from "@/lib/home-scope";
import type { DailyStatus, Task, TaskInsert, TaskProgress } from "@/types";

// Tasks page. All data access lives in useTasks; this component handles the
// view: the toolbar, the tab bar, the list, and the two modals.
export default function TasksPage() {
  // The saved "show completed tasks" preference is a real filter on the list.
  const { preferences } = useResolvedPreferences();

  const {
    tasks,
    counts,
    subtasksByTask,
    categories,
    loading,
    error,
    filter,
    setFilter,
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
    reload,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    progressByTask,
    todayStatusByTask,
    submitDailyStatus,
    dailyLogsByTask,
    allTasks,
  } = useTasks(HOME_SCOPE, { hideCompleted: !preferences.show_completed_tasks });

  // null = closed. For the form, holds the task being edited; for delete, the task to remove.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  // Ids currently mid-mutation, so their controls can be disabled.
  const [busyIds, setBusyIds] = useState<string[]>([]);
  // Failures from the row actions. Previously these went only to the console,
  // which meant clicking Yes on a day the write was rejected looked like it had
  // worked until the page was reloaded.
  const [actionError, setActionError] = useState<string | null>(null);

  function markBusy(id: string, busy: boolean) {
    setBusyIds((prev) => (busy ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setFormOpen(true);
  }

  /** Passed to the modal; returns a promise so the modal can await it. */
  async function handleSubmit(values: TaskInsert) {
    if (editing) {
      await updateTask(editing.id, values);
    } else {
      await createTask(values);
    }
  }

  async function handleToggle(task: Task) {
    markBusy(task.id, true);
    try {
      await toggleTask(task);
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
      setActionError(
        err instanceof Error ? err.message : "Could not delete the task.",
      );
      throw err;
    } finally {
      markBusy(task.id, false);
    }
  }

  // What the confirmation dialog should warn about losing. Both relationships
  // are ON DELETE CASCADE in the database, so this is a description of real
  // behaviour rather than a scare.
  const deleteConsequences = useMemo(() => {
    if (!deleting) return [];
    const subtaskCount = subtasksByTask.get(deleting.id)?.length ?? 0;
    const logCount = dailyLogsByTask.get(deleting.id)?.length ?? 0;
    return [
      subtaskCount > 0 ? `${subtaskCount} checklist item(s)` : null,
      logCount > 0 ? `${logCount} day(s) of completion history` : null,
    ].filter((item): item is string => item !== null);
  }, [deleting, subtasksByTask, dailyLogsByTask]);

  /** Records today's Yes/No for a task, straight from its card. */
  async function handleMarkToday(task: Task, status: DailyStatus) {
    markBusy(task.id, true);
    setActionError(null);
    try {
      await submitDailyStatus(task, status);
    } catch (err) {
      // The hook already rolled the optimistic state back, so the buttons are
      // showing the truth again; the banner explains why nothing was saved.
      setActionError(
        err instanceof Error ? err.message : "Could not save today's status.",
      );
    } finally {
      markBusy(task.id, false);
    }
  }

  // What the empty state should say depends on the active tab - and on whether
  // the toolbar is hiding rows the tab would otherwise contain.
  const emptyCopy: Record<typeof filter, { title: string; hint: string }> = {
    all: { title: "No tasks yet", hint: "Add your first task to get started." },
    today: { title: "Nothing due today", hint: "Your day is clear." },
    upcoming: { title: "Nothing coming up", hint: "Tasks due after today will appear here." },
    overdue: { title: "Nothing overdue", hint: "Nicely on top of things." },
  };

  // The tasks due today, across every tab, so the day can be answered from this
  // page without switching tabs first.
  const todaysTasks = useMemo(
    () => allTasks.filter((task) => matchesFilter(task, "today")),
    [allTasks],
  );
  const todaysAnswered = todaysTasks.filter(
    (task) => todayStatusByTask.get(task.id) != null,
  ).length;
  const todaysYes = todaysTasks.filter(
    (task) => todayStatusByTask.get(task.id) === "yes",
  ).length;

  // When a search or filter is active, "nothing here" usually means "nothing
  // matched" rather than "nothing exists", so say that instead.
  const empty = hasActiveRefinements
    ? {
      title: "No matching tasks",
      hint: "Try a different search, or clear the filters.",
    }
    : emptyCopy[filter];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Tasks"
          description="Assignments and to-dos, grouped by course and due date."
        />

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add task
        </button>
      </div>

      <div className="space-y-4">
        {/* Search, filters and sort. They narrow the list that the tabs then
            slice, and the tab counts follow the same narrowing. */}
        <TaskToolbar
          search={search}
          onSearchChange={setSearch}
          priority={priority}
          onPriorityChange={setPriority}
          category={category}
          onCategoryChange={setCategory}
          status={status}
          onStatusChange={setStatus}
          sort={sort}
          onSortChange={setSort}
          categories={categories}
          hasActiveRefinements={hasActiveRefinements}
          onClear={clearRefinements}
        />

        {/* A checked-off task is hidden by the default refinements (a ">todo"
            status filter, or show_completed_tasks off), which would hide the
            very rows the day-list exists to answer. This strip therefore
            overrides those two refinements only: search, priority, category
            and scope all still apply. */}
        {todaysTasks.length > 0 ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Due today</h2>
              <p className="text-xs text-muted">
                {todaysAnswered}/{todaysTasks.length} answered
                {todaysAnswered > 0 ? ` · ${todaysYes} yes` : ""}
              </p>
            </div>

            <ul className="space-y-2">
              {todaysTasks.map((task) => {
                const today = todayStatusByTask.get(task.id) ?? null;
                return (
                  <li
                    key={task.id}
                    className={`flex flex-col gap-2 rounded-xl border border-border bg-app px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                      busyIds.includes(task.id) ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDueDate(task.due_at)} · {task.category}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={busyIds.includes(task.id)}
                        aria-pressed={today === "yes"}
                        onClick={() => handleMarkToday(task, "yes")}
                        className={`min-w-14 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                          today === "yes"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        disabled={busyIds.includes(task.id)}
                        aria-pressed={today === "no"}
                        onClick={() => handleMarkToday(task, "no")}
                        className={`min-w-14 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                          today === "no"
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <TaskTabs active={filter} onChange={setFilter} counts={counts} />

        {/* Only shown when a Supabase query actually failed. The message comes
            straight from Supabase, and Retry re-runs the query. */}
        {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

        {/* A rejected row action (for example a Yes the database refused). */}
        {actionError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="shrink-0 rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {loading ? (
          <LoadingRows count={3} label="Loading tasks" />
        ) : error ? null : tasks.length === 0 ? (
          <EmptyState
            title={empty.title}
            hint={empty.hint}
            // Offer "Clear filters" while the toolbar is narrowing, and
            // "Add task" only on tabs where creating makes sense.
            actionLabel={
              hasActiveRefinements
                ? "Clear filters"
                : filter === "all" || filter === "today" || filter === "upcoming"
                  ? "Add task"
                  : undefined
            }
            onClick={
              hasActiveRefinements
                ? clearRefinements
                : filter === "all" || filter === "today" || filter === "upcoming"
                  ? openAdd
                  : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                subtasks={subtasksByTask.get(task.id) ?? EMPTY_SUBTASKS}
                subtasksLoading={loading}
                busy={busyIds.includes(task.id)}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={setDeleting}
                onAddSubtask={addSubtask}
                onToggleSubtask={toggleSubtask}
                onDeleteSubtask={deleteSubtask}
                progress={progressByTask.get(task.id) ?? fallbackProgress(task)}
                todayStatus={todayStatusByTask.get(task.id) ?? null}
                onMarkToday={handleMarkToday}
              />
            ))}
          </ul>
        )}

        {/* The preference is active but overridden by an explicit status filter,
            so say so rather than leaving the user wondering. */}
        {!preferences.show_completed_tasks && status !== ALL_STATUSES ? (
          <p className="text-xs text-muted">
            Completed tasks are shown because a status filter is active. Clear it to
            respect your "show completed tasks" setting.
          </p>
        ) : null}
      </div>

      <TaskFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        task={editing}
      />

      <ConfirmDeleteModal
        task={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        consequences={deleteConsequences}
      />
    </>
  );
}

// A stable empty array, so a task with no checklist does not get a fresh [] on
// every render (which would defeat the SubTaskList's memo-friendly props).
const EMPTY_SUBTASKS: never[] = [];

// progressByTask is built for every task on each render, so this only runs in
// the split second before the first render settles. It keeps the card's props
// non-optional without a non-null assertion.
function fallbackProgress(task: Task): TaskProgress {
  return { task, history: [], completedDays: 0, trackedDays: 0, completionRate: 0 };
}

// The list states (loading, error, empty) are shared primitives now - see
// components/ui. They were lifted out of here so the dashboard could use the
// exact same treatment instead of a lookalike.
