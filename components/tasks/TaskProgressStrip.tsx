"use client";

import CompletionChart from "@/components/dashboard/CompletionChart";
import { Button } from "@/components/ui/Button";
import type { DailyStatus, TaskProgress } from "@/types";

// How many recent days the per-task chart plots.
export const TASK_CHART_DAYS = 14;

// The per-task daily history shown on a task card: the green/red chart plus the
// completion percentage. Read-only here - the interactive Yes/No submission
// lives on the dashboard's "Today's Tasks" panel, so this strip just makes the
// task's consistency visible wherever the task appears.
export default function TaskProgressStrip({
  progress,
  onMarkToday,
  busy,
  today,
}: {
  progress: TaskProgress;
  /** When provided, renders the Yes/No buttons for today. */
  onMarkToday?: (task: TaskProgress, status: DailyStatus) => void;
  busy?: boolean;
  /** Today's answer for this task, when the caller tracks it. */
  today?: DailyStatus | null;
}) {
  const { task, history, completionRate, completedDays, trackedDays } = progress;
  const interactive = typeof onMarkToday === "function";

  // "5/7 days" is the raw count of every answered day. The percentage is
  // measured over the same days, so the two never tell different stories.
  return (
    <div className="mt-2 rounded-lg border border-border bg-surface-2/70 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-2xs font-medium text-muted">
          Daily history
          <span className="ml-1.5 font-normal text-muted/80">
            {trackedDays > 0
              ? `${completedDays}/${trackedDays} answered days completed`
              : "no entries yet"}
          </span>
        </p>
        <p
          className={`text-2xs font-semibold tabular-nums ${
            trackedDays === 0
              ? "text-muted"
              : completionRate >= 70
                ? "text-emerald-600 dark:text-emerald-400"
                : completionRate >= 40
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
          }`}
        >
          {trackedDays === 0 ? "—" : `${completionRate}%`}
        </p>
      </div>

      <div className="mt-1.5">
        <CompletionChart
          history={history}
          dayCount={TASK_CHART_DAYS}
          height="h-6"
          label={`${task.title} completion history`}
          showAxis={false}
        />
      </div>

      {interactive ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="mr-0.5 text-2xs text-muted">Today:</span>
          <Button
            variant="success"
            size="sm"
            active={today === "yes"}
            disabled={busy}
            aria-pressed={today === "yes"}
            aria-label={`Mark "${task.title}" done today`}
            onClick={() => onMarkToday?.(progress, "yes")}
            className="h-7"
          >
            Yes
          </Button>
          <Button
            variant="dangerSubtle"
            size="sm"
            active={today === "no"}
            disabled={busy}
            aria-pressed={today === "no"}
            aria-label={`Mark "${task.title}" not done today`}
            onClick={() => onMarkToday?.(progress, "no")}
            className="h-7"
          >
            No
          </Button>
        </div>
      ) : null}
    </div>
  );
}
