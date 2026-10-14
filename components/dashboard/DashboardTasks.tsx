"use client";

import { useMemo, useState } from "react";
import StatTile from "@/components/ui/StatTile";
import DashboardTaskList from "@/components/dashboard/DashboardTaskList";
import TodayTasksPanel from "@/components/dashboard/TodayTasksPanel";
import CompletionChart from "@/components/dashboard/CompletionChart";
import { useTasks, matchesFilter } from "@/hooks/useTasks";
import { CardHeader } from "@/components/ui/Card";
import type { DailyStatus, DailyPoint, Task, TaskFilter, TodayTaskProgress } from "@/types";

// How many rows the dashboard shows before linking off to the full Tasks page.
const MAX_ROWS = 5;

// The same four tabs as /tasks, kept typed so setFilter accepts the key.
const TABS: TaskFilter[] = ["today", "upcoming", "overdue", "all"];

// Dashboard summary. This is the interactive half of the page: it reuses the
// same `useTasks` hook as the Tasks page, so the tab logic, the counts and the
// mutations all come from one implementation.
//
// `initialTasks` comes from the server, so the user sees real numbers on the
// very first paint instead of a spinner; the hook then refetches on mount to
// pick up anything that changed in another tab.
export default function DashboardTasks({ initialTasks }: { initialTasks: Task[] }) {
  const {
    tasks,
    counts,
    loading,
    error,
    reload,
    toggleTask,
    filter,
    setFilter,
    todayProgress,
    submitDailyStatus,
  } = useTasks();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Prefer the seeded rows until the client fetch resolves, so the first render
  // is never an empty hole.
  const rows = loading && tasks.length === 0 ? initialTasks : tasks;

  // Today's tasks = the same predicate the Today tab uses, so the panel at the
  // top and the "Due today" tile can never disagree.
  const todaysTasks = useMemo(
    () => todayProgress.filter((p) => matchesFilter(p.task, "today")),
    [todayProgress],
  );

  // The overall daily-completion picture across every task: each task's most
  // recent answer becomes one bar, so the dashboard shows productivity at a
  // glance without opening each task.
  const overallHistory = useMemo<DailyPoint[]>(() => {
    const byDate = new Map<string, DailyPoint>();
    for (const progress of todayProgress) {
      for (const point of progress.history) byDate.set(point.date, point);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [todayProgress]);

  const overallRate = useMemo(() => {
    const answered = todayProgress.filter((p) => p.today !== null);
    if (answered.length === 0) return 0;
    const yes = answered.filter((p) => p.today === "yes").length;
    return Math.round((yes / answered.length) * 100);
  }, [todayProgress]);

  async function handleDailySubmit(task: TodayTaskProgress, status: DailyStatus) {
    setBusyId(task.task.id);
    try {
      await submitDailyStatus(task.task, status);
    } finally {
      setBusyId(null);
    }
  }

  // Headline numbers. These deliberately reuse the SAME predicates the tab
  // counts use (isOverdue / isUpcoming / matchesFilter), so "Due today" here can
  // never drift from the Today tab on /tasks.
  const stats = useMemo(() => {
    const open = rows.filter((t) => t.status !== "done");
    return {
      dueToday: rows.filter((t) => matchesFilter(t, "today")).length,
      upcoming: rows.filter((t) => matchesFilter(t, "upcoming")).length,
      overdue: rows.filter((t) => matchesFilter(t, "overdue")).length,
      open: open.length,
    };
  }, [rows]);

  // What to show in the panel: whatever tab is active, capped to MAX_ROWS.
  // Same predicate as the counts above and as the Tasks page.
  const visible = useMemo(
    () => rows.filter((t) => matchesFilter(t, filter)).slice(0, MAX_ROWS),
    [rows, filter],
  );

  const totalForTab = counts[filter];

  async function handleToggle(task: Task) {
    setBusyId(task.id);
    try {
      await toggleTask(task);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          >
            Try again
          </button>
        </div>
      ) : null}

      {/* Today's Tasks: the very first thing on the dashboard. Review each task
          scheduled for today and submit its status with Yes or No. */}
      <TodayTasksPanel
        tasks={todaysTasks}
        loading={loading && rows.length === 0}
        onSubmit={handleDailySubmit}
        busyId={busyId}
      />

      {/* Daily completion across all tasks: one chart, plus today's rate. */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <CardHeader
          title="Daily completion"
          action={
            <span className="text-xs font-semibold text-muted">
              {overallRate}% today
            </span>
          }
        />
        <p className="mb-3 text-xs text-muted">
          <span className="mr-3 inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Yes
          </span>
          <span className="mr-3 inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> No
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-border" /> Not answered
          </span>
        </p>
        <CompletionChart
          history={overallHistory}
          dayCount={21}
          height="h-24"
          label="Overall daily completion"
        />
      </section>

      {/* Headline numbers. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Open" value={stats.open} hint="Not finished yet" />
        <StatTile
          label="Due today"
          value={stats.dueToday}
          hint="Deadline is today"
          tone={stats.dueToday > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Overdue"
          value={stats.overdue}
          hint={stats.overdue > 0 ? "Past the deadline" : "All caught up"}
          tone={stats.overdue > 0 ? "danger" : "success"}
        />
        <StatTile label="Upcoming" value={stats.upcoming} hint="Due after today" />
      </div>

      {/* Today's list, with a link through to the full Tasks page. */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <CardHeader
          title="Your tasks"
          action={
            <a
              href="/tasks"
              className="text-xs font-semibold text-accent hover:underline"
            >
              View all
            </a>
          }
        />

        <div className="mb-4 flex gap-1 overflow-x-auto">
          {TABS.map((key) => {
            const selected = filter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  selected
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-accent-soft/50 hover:text-accent"
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>

        <DashboardTaskList
          tasks={visible}
          loading={loading && rows.length === 0}
          busyId={busyId}
          onToggle={handleToggle}
        />

        {totalForTab > visible.length ? (
          <p className="mt-3 text-xs text-muted">
            Showing {visible.length} of {totalForTab}.{" "}
            <a href="/tasks" className="font-semibold text-accent hover:underline">
              See the rest
            </a>
          </p>
        ) : null}
      </section>
    </div>
  );
}

/**
 * The dashboard's headline tiles read from `rows` (which may be the server-seeded
 * list on first paint), while the tab counts come from the hook. Both sides use
 * the shared matchesFilter, so the two views agree once the fetch resolves.
 */
