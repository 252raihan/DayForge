"use client";

import { useMemo, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { useChallenges } from "@/hooks/useChallenges";
import type { ChallengeGoalType, ChallengeProgress } from "@/types";

// Challenges on the dashboard.
//
// Same data layer as /challenges (`useChallenges`), so the numbers here are the
// measured ones - never a separate calculation that could drift. The dashboard
// shows only the challenges that are still worth acting on (active first, then
// not started), plus today's check-in button for the kinds you can check in.
//
// Nothing is invented: a challenge with no measurable goal says so, and an
// empty list points at /challenges rather than pretending there is nothing to do.

/** How many challenges the dashboard shows before linking off to /challenges. */
const MAX_CARDS = 3;

/** The shortest honest description of what each goal counts. */
const GOAL_LABELS: Record<ChallengeGoalType, string> = {
  checkin_count: "Daily check-ins",
  task_completion: "Task completions",
  habit_completion: "Habit check-ins",
  manual: "No measurable goal",
};

export default function DashboardChallenges() {
  const {
    progress,
    loading,
    error,
    reload,
    checkInToday,
    undoCheckInToday,
  } = useChallenges();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Running challenges first, then ones that have not begun. Completed and
  // expired ones are still counted in the header but are not listed: they need
  // no action today. They remain on /challenges in full.
  const visible = useMemo(
    () =>
      progress
        .filter((item) => item.status === "active" || item.status === "not_started")
        .slice(0, MAX_CARDS),
    [progress],
  );

  const counts = useMemo(
    () => ({
      active: progress.filter((item) => item.status === "active").length,
      completed: progress.filter((item) => item.status === "completed").length,
      expired: progress.filter((item) => item.status === "expired").length,
    }),
    [progress],
  );

  async function handleCheckIn(item: ChallengeProgress) {
    setBusyId(item.challenge.id);
    setActionError(null);
    try {
      if (item.checkedInToday) await undoCheckInToday(item.challenge);
      else await checkInToday(item.challenge);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save your check-in.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <CardHeader
        title="Challenges"
        action={
          <a href="/challenges" className="text-xs font-semibold text-accent hover:underline">
            View all
          </a>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
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

      {actionError ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
        >
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Loading challenges">
          {Array.from({ length: 2 }, (_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl border border-border bg-app" />
          ))}
        </ul>
      ) : progress.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-app px-4 py-5 text-center">
          <p className="text-sm font-medium">No challenges yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            Set a time-boxed goal and DayForge counts your progress from real task,
            habit and check-in records.
          </p>
          <a
            href="/challenges"
            className="mt-3 inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create a challenge
          </a>
        </div>
      ) : visible.length === 0 ? (
        // Everything is finished or closed: say what happened, do not show an
        // empty box that looks broken.
        <p className="rounded-xl border border-border bg-app px-3.5 py-3 text-xs text-muted">
          {counts.completed} completed and {counts.expired} expired. Nothing running right
          now -{" "}
          <a href="/challenges" className="font-semibold text-accent hover:underline">
            start a new challenge
          </a>
          .
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((item) => (
            <DashboardChallengeRow
              key={item.challenge.id}
              item={item}
              busy={busyId === item.challenge.id}
              onCheckIn={() => handleCheckIn(item)}
            />
          ))}
        </ul>
      )}

      {!loading && progress.length > 0 ? (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          {counts.active} active
          {counts.completed > 0 ? ` · ${counts.completed} completed` : ""}
          {counts.expired > 0 ? ` · ${counts.expired} expired` : ""}
          {progress.length > visible.length ? (
            <>
              {" · "}
              <a href="/challenges" className="font-semibold text-accent hover:underline">
                See all {progress.length}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

// One challenge: title, status, the measured count and its bar, plus the
// today-only check-in button where one applies.
function DashboardChallengeRow({
  item,
  busy,
  onCheckIn,
}: {
  item: ChallengeProgress;
  busy: boolean;
  onCheckIn: () => void;
}) {
  const { challenge, status, current, target, percent, daysRemaining, checkedInToday } = item;

  const statusLabel =
    status === "not_started" ? "Not started" : status === "active" ? "Active" : status;
  const statusClass =
    status === "not_started"
      ? "bg-border text-muted"
      : "bg-accent-soft text-accent";

  return (
    <li
      className={`rounded-xl border border-border bg-app p-3.5 transition-opacity ${busy ? "opacity-60" : ""
        }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{challenge.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}
            >
              {statusLabel}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted">
            {GOAL_LABELS[challenge.goal_type]}
            {daysRemaining !== null && daysRemaining >= 0
              ? ` · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`
              : ""}
          </p>
        </div>

        {challenge.goal_type === "checkin_count" && status === "active" ? (
          <button
            type="button"
            onClick={onCheckIn}
            disabled={busy}
            aria-pressed={checkedInToday}
            aria-label={`Check in to "${challenge.title}" today`}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${checkedInToday
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              }`}
          >
            {checkedInToday ? "Checked in" : "Check in"}
          </button>
        ) : null}
      </div>

      {/* The bar only exists when there is a real target to divide by. */}
      {target !== null ? (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">
              {current} / {target}
            </span>
            <span className="font-semibold">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? 0}
            aria-label={`${challenge.title} progress`}
            className="h-2 w-full overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-muted">Tracked by hand - no number to show.</p>
      )}
    </li>
  );
}
