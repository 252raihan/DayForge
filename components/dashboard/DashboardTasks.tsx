"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardTaskList from "@/components/dashboard/DashboardTaskList";
import TodayTasksPanel from "@/components/dashboard/TodayTasksPanel";
import DashboardChallenges from "@/components/dashboard/DashboardChallenges";
import DashboardHabits from "@/components/dashboard/DashboardHabits";
import WeeklyProgress from "@/components/dashboard/WeeklyProgress";
import QuickAddTask from "@/components/dashboard/QuickAddTask";
import { useTasks, matchesFilter } from "@/hooks/useTasks";
import { useResolvedPreferences } from "@/lib/preferences";
import { HOME_SCOPE } from "@/lib/home-scope";
import {
  Card,
  CardHeader,
  CardLink,
  EmptyState,
  ErrorBanner,
  ProgressBar,
  ProgressRing,
  SegmentedControl,
  StatTile,
} from "@/components/ui";
import {
  AlertIcon,
  CalendarIcon,
  ListChecksIcon,
  TrendingUpIcon,
} from "@/components/icons";
import type {
  DailyStatus,
  Task,
  TaskFilter,
  TodayTaskProgress,
} from "@/types";

/** One day's aggregate completion, as produced by useTasks().dailyStats. */
type DailyStatPoint = {
  date: string;
  total: number;
  yes: number;
  no: number;
  answered: number;
  percent: number | null;
};

// How many rows the lists show before linking off to the full page.
const MAX_TODAY_ROWS = 4;
const MAX_UPCOMING_ROWS = 4;

const TABS: TaskFilter[] = ["today", "upcoming", "overdue", "all"];

const TAB_LABELS: Record<TaskFilter, string> = {
  today: "Today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  all: "All",
};

// Dashboard body. Reuses the same `useTasks` hook as the Tasks page, so the tab
// logic, the counts, the daily stats and every mutation come from one
// implementation and can never disagree with /tasks.
//
// `initialTasks` comes from the server, so the first paint has real numbers
// instead of a spinner; the hook then refetches on mount.
//
// Layout:
//   [ quick add ]
//   [ metric strip: open / due today / overdue / upcoming ]
//   [ Today's tasks (2fr) ][ Progress ring + weekly chart (1fr) ]
//   [ Upcoming (2fr) ][ Habits (1fr) ][ Challenges (1fr) ]
export default function DashboardTasks({
  initialTasks,
  weekStart,
}: {
  initialTasks: Task[];
  weekStart: number;
}) {
  const { preferences } = useResolvedPreferences();

  const {
    tasks,
    counts,
    loading,
    error,
    reload,
    createTask,
    toggleTask,
    setFilter,
    filter,
    todayProgress,
    submitDailyStatus,
    dailyStats,
  } = useTasks(HOME_SCOPE);

  const [busyId, setBusyId] = useState<string | null>(null);

  // Prefer the seeded rows until the client fetch resolves, so the first render
  // is never an empty hole.
  const rows = loading && tasks.length === 0 ? initialTasks : tasks;

  const todaysTasks = useMemo(
    () => todayProgress.filter((p) => matchesFilter(p.task, "today")),
    [todayProgress],
  );

  const answeredToday = todaysTasks.filter((task) => task.today !== null).length;

  // The trailing 7 daily points, oldest first, for the weekly chart.
  const weekHistory = useMemo(() => dailyStats.points.slice(-7), [dailyStats]);

  const todayPoint: DailyStatPoint | null = dailyStats.today ?? null;

  const stats = useMemo(() => {
    const open = rows.filter((t) => t.status !== "done");
    return {
      open: open.length,
      dueToday: rows.filter((t) => matchesFilter(t, "today")).length,
      overdue: rows.filter((t) => matchesFilter(t, "overdue")).length,
      upcoming: rows.filter((t) => matchesFilter(t, "upcoming")).length,
    };
  }, [rows]);

  // Upcoming: the next few open tasks due after today, soonest first.
  const upcoming = useMemo(
    () =>
      rows
        .filter((t) => matchesFilter(t, "upcoming") && t.status !== "done")
        .slice(0, MAX_UPCOMING_ROWS),
    [rows],
  );

  async function handleDailySubmit(task: TodayTaskProgress, status: DailyStatus) {
    setBusyId(task.task.id);
    try {
      await submitDailyStatus(task.task, status);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(task: Task) {
    setBusyId(task.id);
    try {
      await toggleTask(task);
    } finally {
      setBusyId(null);
    }
  }

  const percent = todayPoint?.percent ?? null;
  const ringTone =
    percent === null ? "accent" : percent >= 70 ? "success" : percent >= 40 ? "warning" : "danger";

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      {/* ---------------------------- Quick add ---------------------------- */}
      <QuickAddTask
        onCreate={(values) => createTask(values)}
        defaultCategory={preferences.default_category}
        defaultPriority={preferences.default_priority}
      />

      {/* --------------------------- Metric strip -------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open tasks"
          value={stats.open}
          hint="Not finished yet"
          href="/tasks"
          icon={<ListChecksIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Due today"
          value={stats.dueToday}
          hint="Deadline is today"
          href="/tasks"
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Overdue"
          value={stats.overdue}
          hint={stats.overdue > 0 ? "Needs attention" : "All clear"}
          tone={stats.overdue > 0 ? "danger" : "default"}
          href="/tasks"
          icon={<AlertIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Upcoming"
          value={stats.upcoming}
          hint="Due after today"
          href="/tasks"
          icon={<TrendingUpIcon className="h-4 w-4" />}
        />
      </div>

      {/* ---------------------- Today + progress --------------------------- */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TodayTasksPanel
            tasks={todaysTasks}
            loading={loading && rows.length === 0}
            onSubmit={handleDailySubmit}
            busyId={busyId}
          />
        </div>

        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col">
            <CardHeader
              title="Today's progress"
              action={<CardLink href="/tasks">Details</CardLink>}
            />

            {loading && rows.length === 0 ? (
              <div className="animate-pulse space-y-3">
                <div className="mx-auto h-24 w-24 rounded-full bg-surface-2" />
                <div className="h-16 rounded-lg bg-surface-2" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <ProgressRing
                    value={percent}
                    tone={ringTone}
                    size={92}
                    stroke={7}
                    label="Today's completion"
                  >
                    <div>
                      <p className="text-xl font-semibold leading-none tabular-nums text-fg">
                        {percent === null ? "—" : `${percent}%`}
                      </p>
                      <p className="mt-0.5 text-3xs uppercase tracking-wide text-muted">
                        done
                      </p>
                    </div>
                  </ProgressRing>

                  <div className="min-w-0 flex-1 space-y-2">
                    <Metric
                      dot="bg-emerald-500"
                      label="Yes"
                      value={todayPoint?.yes ?? 0}
                    />
                    <Metric dot="bg-red-500" label="No" value={todayPoint?.no ?? 0} />
                    <Metric
                      dot="bg-border-strong"
                      label="Not answered"
                      value={Math.max(
                        0,
                        (todayPoint?.total ?? 0) -
                        ((todayPoint?.yes ?? 0) + (todayPoint?.no ?? 0)),
                      )}
                    />
                  </div>
                </div>

                <p className="mt-3 text-2xs leading-relaxed text-muted">
                  {answeredToday === 0
                    ? "Answer today's tasks with Yes or No — the percentage only counts answered days."
                    : `${answeredToday} of ${todaysTasks.length} answered. Unanswered days never count as misses.`}
                </p>

                <div className="mt-auto pt-4">
                  <WeeklyProgress
                    points={weekHistory}
                    windowPercent={dailyStats.windowPercent}
                  />
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ----------------- Upcoming + Habits + Challenges ------------------ */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Upcoming"
            description="Next deadlines, soonest first"
            action={<CardLink href="/tasks">View all</CardLink>}
          />

          {upcoming.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<CalendarIcon className="h-5 w-5" />}
              title={loading ? "Loading…" : "Nothing upcoming"}
              hint="Tasks due after today will show up here with their due date."
              href="/tasks"
              actionLabel="Plan something"
            />
          ) : (
            <DashboardTaskList
              tasks={upcoming}
              loading={false}
              busyId={busyId}
              onToggle={handleToggle}
            />
          )}

          {counts.upcoming > upcoming.length ? (
            <p className="mt-3 text-2xs text-muted">
              Showing {upcoming.length} of {counts.upcoming}.{" "}
              <Link href="/tasks" className="font-medium text-accent hover:underline">
                See the rest
              </Link>
            </p>
          ) : null}
        </Card>

        <DashboardHabits weekStart={weekStart} />
        <DashboardChallenges />
      </div>

      {/* ------------------------ All tasks, filtered ---------------------- */}
      <Card>
        <CardHeader
          title="All tasks"
          description="Every task, narrowed by the tab you pick"
          action={<CardLink href="/tasks">Open tasks</CardLink>}
        />

        <SegmentedControl
          ariaLabel="Filter all tasks"
          value={filter}
          onChange={setFilter}
          options={TABS.map((key) => ({
            value: key,
            label: TAB_LABELS[key],
            badge: (
              <span className="tabular-nums text-2xs text-muted">{counts[key]}</span>
            ),
          }))}
          className="mb-3"
        />

        <DashboardTaskList
          tasks={rows.filter((t) => matchesFilter(t, filter)).slice(0, MAX_TODAY_ROWS)}
          loading={loading && rows.length === 0}
          busyId={busyId}
          onToggle={handleToggle}
        />

        {counts[filter] > MAX_TODAY_ROWS ? (
          <p className="mt-3 text-2xs text-muted">
            Showing {MAX_TODAY_ROWS} of {counts[filter]}.{" "}
            <Link href="/tasks" className="font-medium text-accent hover:underline">
              See the rest
            </Link>
          </p>
        ) : null}

        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1.5 flex items-center justify-between text-2xs text-muted">
            <span>Completed</span>
            <span className="tabular-nums">
              {counts.all - stats.open} of {counts.all}
            </span>
          </div>
          <ProgressBar
            value={counts.all - stats.open}
            max={Math.max(counts.all, 1)}
            tone="success"
            label="Tasks completed across all tasks"
          />
        </div>
      </Card>
    </div>
  );
}

function Metric({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-2xs text-muted">{label}</span>
      <span className="tabular-nums text-xs font-medium text-fg">{value}</span>
    </div>
  );
}
