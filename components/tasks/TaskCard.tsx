"use client";

import type { SubTask, Task } from "@/types";
import { isDueToday, isOverdue, recurrenceLabel } from "@/hooks/useTasks";
import { formatDueDate, PriorityBadge } from "@/components/tasks/task-utils";
import SubTaskList from "@/components/tasks/SubTaskList";

// A single task card: completion checkbox, title, priority badge, due date, the
// recurrence hint, the subtask checklist and the edit/delete actions.
export default function TaskCard({
  task,
  subtasks,
  subtasksLoading,
  onToggle,
  onEdit,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  busy,
}: {
  task: Task;
  /** This task's checklist, oldest first. */
  subtasks: SubTask[];
  /** True while the first subtask fetch is still in flight. */
  subtasksLoading: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddSubtask: (taskId: string, title: string) => Promise<void>;
  onToggleSubtask: (subtask: SubTask) => Promise<void>;
  onDeleteSubtask: (id: string) => Promise<void>;
  /** True while a mutation on this row is in flight. */
  busy?: boolean;
}) {
  const done = task.status === "done";
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const repeats = recurrenceLabel(task);

  // Overdue rows get a red left border and a tinted background so they stand
  // out at a glance; "due today" gets a subtler amber treatment.
  const accent = overdue
    ? "border-l-4 border-l-red-500 bg-red-50/60 dark:bg-red-950/20"
    : dueToday
      ? "border-l-4 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/10"
      : "border-l-4 border-l-transparent";

  return (
    <li
      className={`group rounded-2xl border border-border bg-surface p-4 transition-colors ${accent} ${busy ? "opacity-60" : ""
        }`}
    >
      <div className="flex items-start gap-3">
        {/* Completion checkbox */}
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={() => onToggle(task)}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-border accent-[rgb(var(--accent))]"
          style={{ height: "1.125rem", width: "1.125rem" }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3
              className={`text-sm font-medium ${done ? "text-muted line-through" : ""
                }`}
            >
              {task.title}
            </h3>

            <div className="flex shrink-0 items-center gap-1.5">
              <PriorityBadge priority={task.priority} />
            </div>
          </div>

          {task.description ? (
            <p
              className={`mt-1 whitespace-pre-wrap text-sm ${done ? "text-muted/70" : "text-muted"
                }`}
            >
              {task.description}
            </p>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${overdue
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-muted"
                }`}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5V12l3 2" />
              </svg>
              {formatDueDate(task.due_at)}
            </span>
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
              {task.category}
            </span>

            {/* Recurrence hint, so a repeating task is identifiable at a glance. */}
            {repeats ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 2l4 4-4 4" />
                  <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                  <path d="M7 22l-4-4 4-4" />
                  <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                </svg>
                {repeats}
              </span>
            ) : null}

            {done ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Done
              </span>
            ) : null}
          </div>

          {/* Checklist: add, tick and delete subtasks, with a progress bar. */}
          <SubTaskList
            subtasks={subtasks}
            loading={subtasksLoading}
            onAdd={(title) => onAddSubtask(task.id, title)}
            onToggle={onToggleSubtask}
            onDelete={onDeleteSubtask}
          />
        </div>

        {/* Row actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(task)}
            disabled={busy}
            aria-label={`Edit "${task.title}"`}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onDelete(task)}
            disabled={busy}
            aria-label={`Delete "${task.title}"`}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  );
}
