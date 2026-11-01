"use client";

import type { DailyStatus, SubTask, Task, TaskProgress } from "@/types";
import { isDueToday, isOverdue, recurrenceLabel } from "@/hooks/useTasks";
import { formatDueDate, PriorityBadge } from "@/components/tasks/task-utils";
import SubTaskList from "@/components/tasks/SubTaskList";
import TaskProgressStrip from "@/components/tasks/TaskProgressStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Input";
import {
  ClockIcon,
  EditIcon,
  TrashIcon,
  RepeatIcon,
  FolderIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

// A single task row: completion checkbox, title, priority, due date, category,
// the recurrence hint, the checklist, the daily history and the row actions.
//
// Urgency is expressed with a 2px left rule plus a tinted title icon - not a
// fully tinted card - so a long list stays readable. Completed rows flatten to
// muted text and drop their accent rail.

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
  progress,
  todayStatus,
  onMarkToday,
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
  /** This task's daily history and completion percentage. */
  progress: TaskProgress;
  /** Today's answer for this task (null = not marked yet). */
  todayStatus: DailyStatus | null;
  /** Submits today's Yes/No for this task. Rejects if the write fails. */
  onMarkToday: (task: Task, status: DailyStatus) => Promise<void>;
  /** True while a mutation on this row is in flight. */
  busy?: boolean;
}) {
  const done = task.status === "done";
  const overdue = !done && isOverdue(task);
  const dueToday = !done && isDueToday(task);
  const repeats = recurrenceLabel(task);

  const rail = done
    ? "border-l-transparent"
    : overdue
      ? "border-l-red-500"
      : dueToday
        ? "border-l-amber-400"
        : "border-l-transparent";

  return (
    <li
      className={cn(
        "group rounded-xl border border-l-2 border-border bg-surface shadow-panel transition-colors",
        rail,
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3 p-3.5 sm:p-4">
        <Checkbox
          checked={done}
          disabled={busy}
          onChange={() => onToggle(task)}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className="mt-0.5 h-[17px] w-[17px]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3
              className={cn(
                "min-w-0 break-words text-[13.5px] font-medium leading-relaxed",
                done ? "text-muted line-through decoration-muted/50" : "text-fg",
              )}
            >
              {task.title}
            </h3>

            <div className="flex shrink-0 items-center gap-1.5">
              <PriorityBadge priority={task.priority} />
              {done ? (
                <Badge tone="success" dot>
                  Done
                </Badge>
              ) : null}
            </div>
          </div>

          {task.description ? (
            <p
              className={cn(
                "mt-1 whitespace-pre-wrap text-[13px] leading-relaxed",
                done ? "text-muted/70" : "text-muted",
              )}
            >
              {task.description}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-2xs",
                overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted",
              )}
            >
              <ClockIcon className="h-3.5 w-3.5" />
              {formatDueDate(task.due_at)}
            </span>

            <span className="inline-flex items-center gap-1.5 text-2xs text-muted">
              <FolderIcon className="h-3.5 w-3.5" />
              {task.category}
            </span>

            {/* Recurrence hint, so a repeating task is identifiable at a glance. */}
            {repeats ? (
              <span className="inline-flex items-center gap-1.5 text-2xs text-muted">
                <RepeatIcon className="h-3.5 w-3.5" />
                {repeats}
                {/* A recurring task is one action per day, not one per calendar
                    entry, so say which day today's Yes/No applies to. */}
                {todayStatus
                  ? ` · ${todayStatus === "yes" ? "done today" : "no today"}`
                  : null}
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

          {/* Daily completion history: the green/red chart and the percentage,
              with the Yes/No buttons for today. */}
          <TaskProgressStrip
            progress={progress}
            today={todayStatus}
            busy={busy}
            onMarkToday={() =>
              onMarkToday(task, todayStatus === "yes" ? "no" : "yes")
            }
          />
        </div>

        {/* Row actions: quiet until hover/focus, always reachable by keyboard. */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(task)}
            disabled={busy}
            aria-label={`Edit "${task.title}"`}
          >
            <EditIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(task)}
            disabled={busy}
            aria-label={`Delete "${task.title}"`}
            className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
