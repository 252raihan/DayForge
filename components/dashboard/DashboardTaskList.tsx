"use client";

import { Checkbox, EmptyState, LoadingRows } from "@/components/ui";
import { formatDueDate, PriorityBadge } from "@/components/tasks/task-utils";
import { isDueToday, isOverdue } from "@/hooks/useTasks";
import { ClockIcon } from "@/components/icons";
import type { Task } from "@/types";

// Compact task rows for the dashboard.
//
// Deliberately lighter than TaskCard: no edit/delete here, because the
// dashboard is an overview and the full actions live on /tasks. Only the
// checkbox is interactive, since ticking something off is the common action.
// The due date is a tappable-size row rather than a tiny caption.

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
        size="sm"
        title="Nothing here"
        hint="No tasks match this view yet."
        href="/tasks"
        actionLabel="Go to tasks"
      />
    );
  }

  return (
    <ul className="-mx-1 divide-y divide-border/70">
      {tasks.map((task) => {
        const done = task.status === "done";
        const overdue = isOverdue(task);
        const dueToday = isDueToday(task);

        return (
          <li
            key={task.id}
            className={`flex items-start gap-2.5 px-1 py-2.5 transition-colors first:pt-0 last:pb-0 ${busyId === task.id ? "opacity-60" : ""
              }`}
          >
            <Checkbox
              checked={done}
              disabled={busyId === task.id}
              onChange={() => onToggle(task)}
              aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
              className="mt-0.5"
            />

            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-[13px] font-medium ${done ? "text-muted line-through" : "text-fg"
                  }`}
              >
                {task.title}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`inline-flex items-center gap-1 text-2xs ${overdue && !done ? "font-medium text-red-600 dark:text-red-400" : "text-muted"
                    }`}
                >
                  <ClockIcon className="h-3 w-3" />
                  {formatDueDate(task.due_at)}
                </span>
                <span className="text-2xs text-muted/70" aria-hidden="true">
                  ·
                </span>
                <span className="truncate text-2xs text-muted">{task.category}</span>
                {dueToday && !done ? <DueTodayDot /> : null}
              </div>
            </div>

            <div className="shrink-0 pt-0.5">
              <PriorityBadge priority={task.priority} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Small "today" marker: a dot plus a word, so it is not colour-only. */
function DueTodayDot() {
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-medium text-amber-600 dark:text-amber-400">
      <span className="h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
      today
    </span>
  );
}
