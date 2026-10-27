"use client";

import { useMemo, useState } from "react";
import DashboardTaskList from "@/components/dashboard/DashboardTaskList";
import TodayTasksPanel from "@/components/dashboard/TodayTasksPanel";
import CompletionChart from "@/components/dashboard/CompletionChart";
import DashboardChallenges from "@/components/dashboard/DashboardChallenges";
import { useTasks, matchesFilter } from "@/hooks/useTasks";
import { CardHeader } from "@/components/ui/Card";
import { HOME_SCOPE } from "@/lib/home-scope";
import type { DailyStatus, Task, TaskFilter, TodayTaskProgress } from "@/types";

/** One day's aggregate completion, as produced by useTasks().dailyStats. */
type DailyStatPoint = {
  date: string;
  total: number;
  yes: number;
  no: number;
  answered: number;
  percent: number | null;
};

// How many rows the dashboard shows before linking off to the full Tasks page.
const MAX_ROWS = 5;

// The same four tabs as /tasks, kept typed so setFilter accepts the key.
const TABS: TaskFilter[] = ["today", "upcoming", "overdue", "all"];

// Dashboard summary. Reuses the same `useTasks` hook as the Tasks page, so the
// tab logic, the counts and the mutations all come from one implementation.
//
// `initialTasks` comes from the server, so the user sees real numbers on the
// very first paint instead of a spinner; the hook then refetches on mount to
// pick up anything that changed in another tab.
//
// Layout (desktop):
//   [ stat cards row ]
//   [ Today's Tasks (2fr) ][ Today's Progress (1fr) ]
//   [ Active Challenges (1fr) ][ Recent Tasks (2fr) ]
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
    dailyStats,
  } = useTasks(HOME_SCOPE);
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

  // A 7-day window of the daily points, oldest first, for the progress panel.
  const weekHistory = useMemo(
    () => dailyStats.points.slice(-7),
    [dailyStats],
  );

  async function handleDailySubmit(task: TodayTaskProgress, status: DailyStatus) {
    setBusyId(task.task.id);
    try {
      await submitDailyStatus(task.task, status);
    } finally {
      setBusyId(null);
    }
  }

  // Headline numbers. These deliberately reuse the SAME predicates the tab
  // counts use (matchesFilter), so a tile can never drift from the tab counts
  // on /tasks. All four come from real database rows.
  const stats = useMemo(() => {
    const open = rows.filter((t) => t.status !== "done");
    return {
      open: open.length,
      dueToday: rows.filter((t) => matchesFilter(t, "today")).length,
      overdue: rows.filter((t) => matchesFilter(t, "overdue")).length,
      upcoming: rows.filter((t) => matchesFilter(t, "upcoming")).length,
    };
  }, [rows]);

  // What to show in the panel: whatever tab is active, capped to MAX_ROWS.
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
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 rounded-lg border border-red-400/40 bg-surface px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20"
          >
            Try again
          </button>
        </div>
      ) : null}

      {/* ----------------------------- Stat cards ---------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open Tasks"
          value={stats.open}
          hint="Not finished yet"
          icon={<StatIcon path="M4 5.5h16M4 12h16M4 18.5h10" tone="blue" />}
          tone="blue"
        />
        <StatCard
          label="Due Today"
          value={stats.dueToday}
          hint="Deadline is today"
          icon={<StatIcon path="M12 7.5v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" tone="violet" />}
          tone="violet"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint="Needs your attention"
          icon={<StatIcon path="M12 8v5M12 16.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" tone="red" />}
          tone="red"
        />
        <StatCard
          label="Upcoming"
          value={stats.upcoming}
          hint="Due after today"
          icon={<StatIcon path="M4 16.5 9 11l3.5 3.5L20 6.5M15 6.5h5v5" tone="green" />}
          tone="green"
        />
      </div>

      {/* ------------------ Today's Tasks + Today's Progress ----------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TodayTasksPanel
            tasks={todaysTasks}
            loading={loading && rows.length === 0}
            onSubmit={handleDailySubmit}
            busyId={busyId}
          />
        </div>

        <div className="lg:col-span-2">
          <TodayProgressPanel
            today={dailyStats.today}
            history={weekHistory}
            loading={loading && rows.length === 0}
          />
        </div>
      </div>

      {/* ---------------- Active Challenges + Recent Tasks ------------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DashboardChallenges />
        </div>

        {/* Recent tasks, with tabs and a link through to the full Tasks page. */}
        <section className="rounded-2xl border border-border bg-surface p-5 lg:col-span-3">
          <CardHeader
            title="Recent Tasks"
            action={
              <a href="/tasks" className="text-xs font-semibold text-accent hover:underline">
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
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${selected
                      ? "bg-accent text-white"
                      : "text-muted hover:bg-white/5 hover:text-white"
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

const TONES = {
  blue: {
    ring: "border-blue2/30",
    glow: "from-blue2/25",
    text: "text-blue2",
  },
  violet: {
    ring: "border-brand-500/30",
    glow: "from-brand-500/25",
    text: "text-brand-400",
  },
  red: {
    ring: "border-red2/30",
    glow: "from-red2/25",
    text: "text-red2",
  },
  green: {
    ring: "border-green2/30",
    glow: "from-green2/25",
    text: "text-green2",
  },
} as const;

/** A single headline number with its icon, accent and hover lift. */
function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${t.ring} bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card sm:p-5`}
    >
      {/* Corner glow that brightens on hover. */}
      <span
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${t.glow} to-transparent opacity-60 transition-opacity group-hover:opacity-100`}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted">{label}</p>
          <p className="mt-1 text-3xl font-semibold leading-none text-white">{value}</p>
          <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.text}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

/** Stroke icon for the stat cards, tinted by tone. */
function StatIcon({ path, tone }: { path: string; tone: keyof typeof TONES }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-5 w-5 ${TONES[tone].text}`}
    >
      <path d={path} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Today's Progress panel
// ---------------------------------------------------------------------------

/**
 * Daily completion: today's percentage, the yes/no/not-answered counts, and the
 * 7-day chart. All of it derives from `dailyStats`, which is computed from the
 * persisted task_daily_logs by the same logic the Tasks page uses.
 */
function TodayProgressPanel({
  today,
  history,
  loading,
}: {
  /** Today's daily point from the hook, or null before anything is fetched. */
  today: DailyStatPoint | null;
  /** The last 7 daily points, oldest first. */
  history: DailyStatPoint[];
  loading: boolean;
}) {
  const percent = today?.percent ?? null;
  const yes = today?.yes ?? 0;
  const no = today?.no ?? 0;
  const total = today?.total ?? 0;
  const notAnswered = Math.max(0, total - (yes + no));

  const chartHistory = history.map((point) => ({
    date: point.date,
    completed: point.percent === 100,
  }));

  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-busy={loading}>
      <CardHeader title="Today's Progress" />

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 rounded-xl bg-app" />
          <div className="h-16 rounded-xl bg-app" />
          <div className="h-14 rounded-xl bg-app" />
        </div>
      ) : (
        <>
          {/* Headline percentage */}
          <div className="rounded-xl border border-border bg-app/70 px-4 py-3.5">
            <div className="flex items-end justify-between gap-3">
              <p className="text-xs font-medium text-muted">Completion today</p>
              <p
                className={`text-3xl font-semibold leading-none ${percent === null
                    ? "text-slate-400"
                    : percent >= 70
                      ? "text-green2"
                      : percent >= 40
                        ? "text-amber-400"
                        : "text-red2"
                  }`}
              >
                {percent === null ? "—" : `${percent}%`}
              </p>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {percent === null
                ? "Nothing answered yet today."
                : `${yes} yes and ${no} no out of ${total} open task${total === 1 ? "" : "s"}.`}
            </p>
          </div>

          {/* Yes / No / Not answered counts */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Count label="Yes" value={yes} dot="bg-green2" />
            <Count label="No" value={no} dot="bg-red2" />
            <Count label="Not answered" value={notAnswered} dot="bg-border" />
          </div>

          {/* 7-day chart, real data only */}
          <div className="mt-4">
            <CompletionChart
              history={chartHistory}
              dayCount={7}
              height="h-20"
              label="Last 7 days completion"
              showAxis
            />
          </div>

          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            Green = Yes, red = No, grey = not answered. The percentage is over
            the days you answered, so unanswered days never count as misses.
          </p>
        </>
      )}
    </section>
  );
}

function Count({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-xl border border-border bg-app/70 px-2.5 py-2 text-center">
      <span className={`mx-auto mb-1 block h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      <p className="text-lg font-semibold leading-none text-white">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted">{label}</p>
    </div>
  );
}
