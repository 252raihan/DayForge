"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import CompletionChart from "@/components/dashboard/CompletionChart";
import { PriorityBadge } from "@/components/tasks/task-utils";
import { ListChecksIcon } from "@/components/icons";
import type { DailyStatus, TodayTaskProgress } from "@/types";

// "Today's tasks" - the panel that answers the question "what happens now?".
//
// For each task scheduled today it shows the title, its recent history chart,
// the running completion percentage, and the two buttons that submit today's
// status: "Yes" (completed) and "No" (not completed). The write is an upsert
// keyed on (task, day), so a user can change their answer during the day and
// nothing is duplicated.
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

  const pct =
    summary.total === 0 ? 0 : Math.round((summary.answered / summary.total) * 100);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Today's tasks"
        icon={<ListChecksIcon className="h-4 w-4" />}
        description="Answer each one Yes or No — the percentage updates immediately."
        action={
          !loading && summary.total > 0 ? (
            <p className="tabular-nums text-2xs font-medium text-muted">
              {summary.answered}/{summary.total} answered
            </p>
          ) : null
        }
      />

      {error ? (
        <div className="mb-3">
          <Alert onDismiss={() => setError(null)}>{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Loading today's tasks">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="h-[86px] animate-pulse rounded-lg bg-surface-2" />
          ))}
        </ul>
      ) : tasks.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<ListChecksIcon className="h-5 w-5" />}
          title="Nothing due today"
          hint="Tasks due today appear here so you can answer them Yes or No."
          href="/tasks"
          actionLabel="Plan your day"
        />
      ) : (
        <>
          {/* Thin progress rail above the list: the day's answered share. */}
          <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-smooth"
              style={{ width: `${pct}%` }}
            />
          </div>

          <ul className="-mx-1 space-y-1">
            {tasks.map((progress) => (
              <TodayTaskRow
                key={progress.task.id}
                progress={progress}
                busy={busyId === progress.task.id}
                onSubmit={handleSubmit}
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// One row: title + metadata, the history chart, the running percentage and the
// Yes/No pair. Stacks below `sm`; on phones the buttons stay at 44px tap height.
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

  return (
    <li
      className={`rounded-lg px-1 py-2 transition-colors hover:bg-surface-2/60 ${busy ? "opacity-60" : ""
        }`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="min-w-0 truncate text-[13px] font-medium text-fg">{task.title}</p>
            <PriorityBadge priority={task.priority} />
          </div>
          <p className="mt-0.5 truncate text-2xs text-muted">
            {task.category}
            {trackedDays > 0
              ? ` · ${completedDays}/${trackedDays} days completed`
              : " · No history yet"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="success"
            size="sm"
            active={today === "yes"}
            disabled={busy}
            aria-pressed={today === "yes"}
            aria-label={`Mark "${task.title}" yes for today`}
            onClick={() => onSubmit(progress, "yes")}
            className="h-8 min-w-14 sm:h-7"
          >
            Yes
          </Button>
          <Button
            variant="dangerSubtle"
            size="sm"
            active={today === "no"}
            disabled={busy}
            aria-pressed={today === "no"}
            aria-label={`Mark "${task.title}" no for today`}
            onClick={() => onSubmit(progress, "no")}
            className="h-8 min-w-14 sm:h-7"
          >
            No
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <CompletionChart
            history={progress.history}
            dayCount={14}
            height="h-8"
            label={`${task.title} completion history`}
            showAxis={false}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {today !== null ? (
            <Badge tone={today === "yes" ? "success" : "danger"} dot>
              {today === "yes" ? "Yes" : "No"}
            </Badge>
          ) : (
            <Badge tone="neutral">Unanswered</Badge>
          )}
          <p
            className={`w-9 text-right text-xs font-semibold tabular-nums ${trackedDays === 0
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
      </div>
    </li>
  );
}
