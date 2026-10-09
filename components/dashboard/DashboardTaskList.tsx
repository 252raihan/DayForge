"use client";

import { EmptyState, LoadingRows } from "@/components/ui";
import { formatDueDate, PriorityBadge } from "@/components/tasks/task-utils";
import { isDueToday, isOverdue } from "@/hooks/useTasks";
import type { Task } from "@/types";

// Compact read-only task rows for the dashboard.
//
// Deliberately lighter than TaskCard: no edit/delete here, because the
// dashboard is an overview and the full actions live on /tasks. Only the
// checkbox is interactive, since ticking something off is the common action.
export default function DashboardTaskList({
  tasks,
  loading,
  busyId,
  onToggle,
}: {
  tasks: Task[];
  loading: boolean;
  /** Id of the row currently saving, so its checkbox can be disabled. */
  busyId: string | null;
  onToggle: (task: Task) => void;
}) {
  if (loading) return <LoadingRows count={3} label="Loading tasks" />;

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Nothing here"
        hint="No tasks match this view yet."
        href="/tasks"
        actionLabel="Go to tasks"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const done = task.status === "done";
        const overdue = isOverdue(task);
        const dueToday = isDueToday(task);

        // Same colour language as the Tasks page: red = overdue, amber = today.
        const accent = overdue
          ? "border-l-4 border-l-red-500"
          : dueToday && !done
            ? "border-l-4 border-l-amber-400"
            : "border-l-4 border-l-transparent";

        return (
          <li
            key={task.id}
            className={`flex items-start gap-3 rounded-xl border border-border bg-app px-3.5 py-2.5 ${accent} ${busyId === task.id ? "opacity-60" : ""
              }`}
          >
            <input
              type="checkbox"
              checked={done}
              disabled={busyId === task.id}
              onChange={() => onToggle(task)}
              aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
              className="mt-0.5 shrink-0 cursor-pointer rounded border-border accent-[rgb(var(--accent))]"
              style={{ height: "1.125rem", width: "1.125rem" }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p
                  className={`truncate text-sm font-medium ${done ? "text-muted line-through" : ""}`}
                >
                  {task.title}
                </p>
                <PriorityBadge priority={task.priority} />
              </div>

              <p
                className={`mt-0.5 truncate text-xs ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted"
                  }`}
              >
                {formatDueDate(task.due_at)} · {task.category}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
