"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  buttonStyles,
  Card,
  CardHeader,
  CardLink,
  ErrorBanner,
  ProgressBar,
} from "@/components/ui";
import { ChallengesIcon } from "@/components/icons";
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
    <Card>
      <CardHeader
        title="Challenges"
        icon={<ChallengesIcon className="h-4 w-4" />}
        action={<CardLink href="/challenges">View all</CardLink>}
      />

      {error ? (
        <div className="mb-3">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {actionError ? (
        <Alert className="mb-3" onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      {loading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Loading challenges">
          {Array.from({ length: 2 }, (_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-lg border border-border bg-surface-2" />
          ))}
        </ul>
      ) : progress.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-5 text-center">
          <p className="text-[13px] font-medium text-fg">No challenges yet</p>
          <p className="mx-auto mt-1 max-w-sm text-2xs leading-relaxed text-muted">
            Set a time-boxed goal and DayForge counts your progress from real task,
            habit and check-in records.
          </p>
          <Link
            href="/challenges"
            className={buttonStyles({ variant: "secondary", size: "sm", className: "mt-3" })}
          >
            Create a challenge
          </Link>
        </div>
      ) : visible.length === 0 ? (
        // Everything is finished or closed: say what happened, do not show an
        // empty box that looks broken.
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-2xs leading-relaxed text-muted">
          {counts.completed} completed and {counts.expired} expired. Nothing running right
          now —{" "}
          <Link href="/challenges" className="font-medium text-accent hover:underline">
            start a new challenge
          </Link>
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
        <p className="mt-3 border-t border-border pt-3 text-2xs text-muted">
          {counts.active} active
          {counts.completed > 0 ? ` · ${counts.completed} completed` : ""}
          {counts.expired > 0 ? ` · ${counts.expired} expired` : ""}
          {progress.length > visible.length ? (
            <>
              {" · "}
              <Link href="/challenges" className="font-medium text-accent hover:underline">
                See all {progress.length}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </Card>
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
  const statusTone =
    status === "not_started" ? "neutral" : status === "active" ? "accent" : "success";

  return (
    <li
      className={`rounded-lg border border-border bg-surface-2/60 p-3 transition-opacity ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-[13px] font-medium text-fg">{challenge.title}</p>
            <Badge tone={statusTone} dot>
              {statusLabel}
            </Badge>
          </div>

          <p className="mt-1 text-2xs text-muted">
            {GOAL_LABELS[challenge.goal_type]}
            {daysRemaining !== null && daysRemaining >= 0
              ? ` · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`
              : ""}
          </p>
        </div>

        {challenge.goal_type === "checkin_count" && status === "active" ? (
          <Button
            variant="success"
            size="sm"
            active={checkedInToday}
            onClick={onCheckIn}
            disabled={busy}
            aria-pressed={checkedInToday}
            aria-label={`Check in to "${challenge.title}" today`}
          >
            {checkedInToday ? "Checked in" : "Check in"}
          </Button>
        ) : null}
      </div>

      {/* The bar only exists when there is a real target to divide by. */}
      {target !== null ? (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-2xs">
            <span className="tabular-nums text-muted">
              {current} / {target}
            </span>
            <span className="font-semibold tabular-nums text-fg">{percent}%</span>
          </div>
          <ProgressBar
            value={current}
            max={target}
            label={`${challenge.title} progress`}
          />
        </div>
      ) : (
        <p className="mt-2.5 text-2xs text-muted">Tracked by hand — no number to show.</p>
      )}
    </li>
  );
}
