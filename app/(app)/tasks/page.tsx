"use client";

import { useState } from "react";
import { PageHeader } from "@/components";
import { EmptyState, ErrorBanner, LoadingRows } from "@/components/ui";
import TaskTabs from "@/components/tasks/TaskTabs";
import TaskToolbar from "@/components/tasks/TaskToolbar";
import TaskCard from "@/components/tasks/TaskCard";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import ConfirmDeleteModal from "@/components/tasks/ConfirmDeleteModal";
import { useTasks } from "@/hooks/useTasks";
import type { DailyStatus, Task, TaskInsert, TaskProgress } from "@/types";

// Tasks page. All data access lives in useTasks; this component handles the
// view: the toolbar, the tab bar, the list, and the two modals.
export default function TasksPage() {
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
  } = useTasks();

  // null = closed. For the form, holds the task being edited; for delete, the task to remove.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  // Ids currently mid-mutation, so their controls can be disabled.
  const [busyIds, setBusyIds] = useState<string[]>([]);

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
    try {
      await deleteTask(task.id);
    } finally {
      markBusy(task.id, false);
    }
  }

  /** Records today's Yes/No for a task, straight from its card. */
  async function handleMarkToday(task: Task, status: DailyStatus) {
    markBusy(task.id, true);
    try {
      await submitDailyStatus(task, status);
    } catch (err) {
      console.error("[DayForge] failed to submit daily status:", err);
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

        <TaskTabs active={filter} onChange={setFilter} counts={counts} />

        {/* Only shown when a Supabase query actually failed. The message comes
            straight from Supabase, and Retry re-runs the query. */}
        {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

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
