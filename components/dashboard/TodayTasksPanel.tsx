"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import CompletionChart from "@/components/dashboard/CompletionChart";
import { PriorityBadge } from "@/components/tasks/task-utils";
import type { DailyStatus, TodayTaskProgress } from "@/types";

// "Today's Tasks" - the section pinned to the very top of the dashboard.
//
// For each task scheduled today it shows the title, a small history chart, the
// running completion percentage, and the two buttons that submit today's status:
// "Yes" (completed) and "No" (not completed). Submitting is an upsert keyed on
// (task, day), so a user can change their answer during the day and nothing is
// duplicated.
//
// There are deliberately NO per-task alerts or notifications anywhere in this
// feature. Everything the user needs is on this panel, and the daily reminder
// is simply "look at the top of the dashboard".
export default function TodayTasksPanel({
  tasks,
  loading,
  onSubmit,
  busyId,
}: {
  /** Today's tasks with their history and today's answer. */
  tasks: TodayTaskProgress[];
  loading: boolean;
  onSubmit: (task: TodayTaskProgress, status: DailyStatus) => Promise<void>;
  /** Id of the task currently saving, so its buttons can be disabled. */
  busyId: string | null;
}) {
  const [error, setError] = useState<string | null>(null);

  // A short summary line for the section header: how many of today's tasks are
  // already answered, and how many of those were "Yes".
  const summary = useMemo(() => {
    const answered = tasks.filter((t) => t.today !== null);
    const yes = tasks.filter((t) => t.today === "yes").length;
    return { answered: answered.length, total: tasks.length, yes };
  }, [tasks]);

  async function handleSubmit(task: TodayTaskProgress, status: DailyStatus) {
    setError(null);
    try {
      await onSubmit(task, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save today's status.");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Today&apos;s Tasks</h2>
          <p className="mt-0.5 text-xs text-muted">
            Mark each task as done today: Yes or No. Your percentage updates instantly.
          </p>
        </div>

        {!loading && summary.total > 0 ? (
          <p className="text-xs font-medium text-muted">
            {summary.answered}/{summary.total} answered
            {summary.answered > 0 ? ` · ${summary.yes} yes` : ""}
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Loading today's tasks">
          {Array.from({ length: 2 }, (_, i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-app"
            />
          ))}
        </ul>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Nothing scheduled today"
          hint="Tasks due today will appear here so you can mark them Yes or No."
          href="/tasks"
          actionLabel="Go to tasks"
        />
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((progress) => (
            <TodayTaskRow
              key={progress.task.id}
              progress={progress}
              busy={busyId === progress.task.id}
              onSubmit={handleSubmit}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// One row: title + metadata on the left, chart in the middle, the Yes/No buttons
// and the percentage on the right. Stacks on small screens.
function TodayTaskRow({
  progress,
  busy,
  onSubmit,
}: {
  progress: TodayTaskProgress;
  busy: boolean;
  onSubmit: (task: TodayTaskProgress, status: DailyStatus) => Promise<void>;
}) {
  const { task, today, completionRate, completedDays, trackedDays } = progress;
  const answeredToday = today !== null;

  return (
    <li
      className={`rounded-xl border border-border bg-app p-3.5 transition-opacity ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{task.title}</p>
            <PriorityBadge priority={task.priority} />
            {answeredToday ? (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  today === "yes"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {today === "yes" ? "Yes today" : "No today"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                Not marked yet
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-muted">
            {task.category}
            {trackedDays > 0
              ? ` · ${completedDays}/${trackedDays} days completed`
              : " · No history yet"}
          </p>
        </div>

        {/* Yes / No submission. Disabled while saving, and the active answer is
            highlighted so the current state is obvious at a glance. */}
        <div className="flex shrink-0 items-center gap-2">
          <StatusButton
            label="Yes"
            active={today === "yes"}
            disabled={busy}
            tone="yes"
            onClick={() => onSubmit(progress, "yes")}
          />
          <StatusButton
            label="No"
            active={today === "no"}
            disabled={busy}
            tone="no"
            onClick={() => onSubmit(progress, "no")}
          />
        </div>
      </div>

      {/* History chart + the running completion percentage. */}
      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <CompletionChart
            history={progress.history}
            dayCount={14}
            height="h-12"
            label={`${task.title} completion history`}
            showAxis={false}
          />
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-lg font-semibold leading-none ${
              completionRate >= 70
                ? "text-emerald-600 dark:text-emerald-400"
                : completionRate >= 40
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {completionRate}%
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">Completed</p>
        </div>
      </div>
    </li>
  );
}

// The Yes/No buttons. Colour reinforces the choice but the label always states
// it, so the control is unambiguous without colour.
function StatusButton({
  label,
  active,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  tone: "yes" | "no";
  onClick: () => void;
}) {
  const activeClass =
    tone === "yes"
      ? "border-emerald-500 bg-emerald-500 text-white"
      : "border-red-500 bg-red-500 text-white";
  const idleClass =
    tone === "yes"
      ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
      : "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`Mark "${label}" for today`}
      className={`min-w-14 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
        active ? activeClass : idleClass
      }`}
    >
      {label}
    </button>
  );
}
