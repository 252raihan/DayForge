"use client";

import CompletionChart from "@/components/dashboard/CompletionChart";
import type { DailyStatus, TaskProgress } from "@/types";

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

  return (
    <div className="mt-3 rounded-xl border border-border bg-app px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-medium text-muted">
          Daily history
          <span className="ml-1.5 font-normal">
            {trackedDays > 0
              ? `${completedDays}/${trackedDays} days completed`
              : "no entries yet"}
          </span>
        </p>
        <p
          className={`text-xs font-semibold ${completionRate >= 70
              ? "text-emerald-600 dark:text-emerald-400"
              : completionRate >= 40
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
            }`}
        >
          {completionRate}%
        </p>
      </div>

      <div className="mt-2">
        <CompletionChart
          history={history}
          dayCount={14}
          height="h-12"
          label={`${task.title} completion history`}
          showAxis={false}
        />
      </div>

      {interactive ? (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[11px] text-muted">Today:</span>
          <button
            type="button"
            disabled={busy}
            aria-pressed={today === "yes"}
            onClick={() => onMarkToday?.(progress, "yes")}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${today === "yes"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              }`}
          >
            Yes
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={today === "no"}
            onClick={() => onMarkToday?.(progress, "no")}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${today === "no"
                ? "border-red-500 bg-red-500 text-white"
                : "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
              }`}
          >
            No
          </button>
        </div>
      ) : null}
    </div>
  );
}
