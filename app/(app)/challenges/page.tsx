"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/tasks/Modal";
import { EmptyState, ErrorBanner, LoadingRows, StatTile } from "@/components/ui";
import { Field, FormMessage } from "@/components/ui/Form";
import { useChallenges } from "@/hooks/useChallenges";
import { todayKey } from "@/hooks/useTasks";
import { dayKeysBetween, longestDailyStreak } from "@/lib/challenge-utils";
import type {
  Challenge,
  ChallengeGoalType,
  ChallengeInsert,
  ChallengeProgress,
} from "@/types";

// Challenges: time-boxed goals whose progress is measured, not asserted.
//
// Each goal type says exactly what it counts, and the card reports the real
// number of matching records (see lib/challenge-utils.ts). A goal with nothing
// to count shows "No measurable goal" rather than an invented percentage.

const GOAL_LABELS: Record<ChallengeGoalType, { label: string; hint: string }> = {
  checkin_count: {
    label: "Daily check-ins",
    hint: "Counts each day you check in - press \"Check in\" on the card.",
  },
  task_completion: {
    label: "Task completions",
    hint: "Counts every \"Yes\" you log on a task during the challenge.",
  },
  habit_completion: {
    label: "Habit check-ins",
    hint: "Counts every habit you tick off during the challenge.",
  },
  manual: { label: "No measurable goal", hint: "Tracked by hand - no number to show." },
};

export default function ChallengesPage() {
  const {
    progress,
    checkinsByChallenge,
    loading,
    error,
    reload,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    checkInToday,
    undoCheckInToday,
  } = useChallenges();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [deleting, setDeleting] = useState<Challenge | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = progress.filter((item) => item.status === "active").length;
  const completed = progress.filter((item) => item.status === "completed").length;
  const expired = progress.filter((item) => item.status === "expired").length;

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

  async function handleDelete(challenge: Challenge) {
    setBusyId(challenge.id);
    setActionError(null);
    try {
      await deleteChallenge(challenge.id);
      setDeleting(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not delete the challenge.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Challenges"
          description="Time-boxed goals and streaks to keep your study routine on track. Progress is counted from your real task, habit and check-in records."
        />

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New challenge
        </button>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      {!loading && progress.length > 0 ? (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total" value={progress.length} hint="All challenges" />
          <StatTile label="Active" value={active} hint="Running now" />
          <StatTile
            label="Completed"
            value={completed}
            hint="Goal reached"
            tone={completed > 0 ? "success" : "default"}
          />
          <StatTile
            label="Expired"
            value={expired}
            hint={expired > 0 ? "Window closed" : "None"}
            tone={expired > 0 ? "warning" : "default"}
          />
        </div>
      ) : null}

      {loading ? (
        <LoadingRows count={3} label="Loading challenges" />
      ) : progress.length === 0 ? (
        <EmptyState
          title="No challenges yet"
          hint="Set a time-boxed goal, then let DayForge count your progress for you."
          actionLabel="New challenge"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="space-y-3">
          {progress.map((item) => (
            <ChallengeCard
              key={item.challenge.id}
              item={item}
              checkinDates={(checkinsByChallenge.get(item.challenge.id) ?? []).map(
                (checkin) => checkin.log_date,
              )}
              busy={busyId === item.challenge.id}
              onCheckIn={() => handleCheckIn(item)}
              onEdit={() => {
                setEditing(item.challenge);
                setFormOpen(true);
              }}
              onDelete={() => setDeleting(item.challenge)}
            />
          ))}
        </ul>
      )}

      <ChallengeFormModal
        open={formOpen}
        challenge={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) await updateChallenge(editing.id, values);
          else await createChallenge(values);
        }}
      />

      {/* Deleting a challenge takes its check-ins with it, so say so. */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this challenge?"
        description="Its check-in history is removed with it. This can't be undone."
      >
        {deleting ? (
          <p className="mb-5 rounded-xl border border-border bg-app px-3.5 py-2.5 text-sm">
            {deleting.title}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setDeleting(null)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting ? busyId === deleting.id : false}
            onClick={() => deleting && handleDelete(deleting)}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-40"
          >
            Delete challenge
          </button>
        </div>
      </Modal>
    </>
  );
}

// One challenge: status, progress bar, the measured numbers, and the actions.
function ChallengeCard({
  item,
  checkinDates,
  busy,
  onCheckIn,
  onEdit,
  onDelete,
}: {
  item: ChallengeProgress;
  checkinDates: string[];
  busy: boolean;
  onCheckIn: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { challenge, status, current, target, percent, daysRemaining, checkedInToday } = item;
  const goal = GOAL_LABELS[challenge.goal_type];

  const statusStyles: Record<typeof status, string> = {
    active: "bg-accent-soft text-accent",
    completed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    expired: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    not_started: "bg-border text-muted",
  };
  const statusLabels: Record<typeof status, string> = {
    active: "Active",
    completed: "Completed",
    expired: "Expired",
    not_started: "Not started",
  };

  // The longest run of consecutive check-in days. Only meaningful where the
  // check-in button exists, so it is only shown for checkin_count challenges.
  const streak =
    challenge.goal_type === "checkin_count" ? longestDailyStreak(checkinDates) : null;

  const windowDays = challenge.target_date
    ? dayKeysBetween(challenge.start_date, challenge.target_date).length
    : null;
  const elapsedDays = Math.max(
    0,
    dayKeysBetween(challenge.start_date, todayKey()).length,
  );

  return (
    <li
      className={`rounded-2xl border border-border bg-surface p-4 ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{challenge.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[status]}`}
            >
              {statusLabels[status]}
            </span>
          </div>

          {challenge.description ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
              {challenge.description}
            </p>
          ) : null}

          <p className="mt-1.5 text-xs text-muted">
            {formatKey(challenge.start_date)}
            {challenge.target_date ? ` → ${formatKey(challenge.target_date)}` : " → open-ended"}
            {windowDays !== null ? ` · ${windowDays} day window` : null}
            {daysRemaining !== null
              ? daysRemaining >= 0
                ? ` · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`
                : ` · ended ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago`
              : ` · day ${elapsedDays}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Progress. The bar is only drawn when there is a real target. */}
      {target !== null ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">{goal.label}</span>
            <span className="font-semibold">
              {current} / {target} ({percent}%)
            </span>
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
              className={`h-full rounded-full transition-all ${
                status === "completed"
                  ? "bg-emerald-500"
                  : status === "expired"
                    ? "bg-amber-500"
                    : "bg-accent"
              }`}
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted">
          {goal.label}: nothing to count for this challenge. Edit it to add a goal type
          and target.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {goal.hint}
          {streak !== null && checkinDates.length > 0
            ? ` · longest run ${streak} day${streak === 1 ? "" : "s"}`
            : ""}
        </p>

        {challenge.goal_type === "checkin_count" ? (
          <button
            type="button"
            onClick={onCheckIn}
            disabled={busy}
            aria-pressed={checkedInToday}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
              checkedInToday
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            }`}
          >
            {checkedInToday ? "Checked in today" : "Check in"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

// Create / edit dialog.
function ChallengeFormModal({
  open,
  challenge,
  onClose,
  onSubmit,
}: {
  open: boolean;
  challenge: Challenge | null;
  onClose: () => void;
  onSubmit: (values: ChallengeInsert) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayKey());
  const [targetDate, setTargetDate] = useState("");
  const [goalType, setGoalType] = useState<ChallengeGoalType>("checkin_count");
  const [goalTarget, setGoalTarget] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // Seed the fields when the dialog opens, without an effect that would fight
  // the user's typing.
  const key = `${open ? "open" : "closed"}:${challenge?.id ?? "new"}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    setTitle(challenge?.title ?? "");
    setDescription(challenge?.description ?? "");
    setStartDate(challenge?.start_date ?? todayKey());
    setTargetDate(challenge?.target_date ?? "");
    setGoalType(challenge?.goal_type ?? "checkin_count");
    setGoalTarget(challenge?.goal_target ? String(challenge.goal_target) : "30");
    setError(null);
    setPending(false);
  }
  if (!open && seededFor !== null) setSeededFor(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Give the challenge a title.");
      return;
    }
    if (trimmedTitle.length > 120) {
      setError("That title is too long (120 characters max).");
      return;
    }

    // The database enforces this too; checking here means a clear message
    // instead of a raw constraint violation.
    if (targetDate && targetDate < startDate) {
      setError("The target date cannot be before the start date.");
      return;
    }

    const parsedTarget = goalType === "manual" ? null : Number(goalTarget);
    if (goalType !== "manual" && (!Number.isFinite(parsedTarget) || (parsedTarget ?? 0) <= 0)) {
      setError("Enter a target greater than zero, or choose \"No measurable goal\".");
      return;
    }

    setPending(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
        start_date: startDate,
        target_date: targetDate || null,
        goal_type: goalType,
        goal_target: parsedTarget,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the challenge.");
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={challenge ? "Edit challenge" : "New challenge"}
      description="Pick a measurable goal and a window. Progress is counted from real records."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <FormMessage>{error}</FormMessage> : null}

        <Field
          id="challenge-title"
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. 30 days of revision"
          required
        />

        <div className="space-y-1.5">
          <label htmlFor="challenge-description" className="block text-sm font-medium">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="challenge-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="challenge-start"
            label="Start date"
            type="date"
            value={startDate}
            onChange={setStartDate}
            required
          />
          <Field
            id="challenge-target"
            label="Target date"
            type="date"
            value={targetDate}
            onChange={setTargetDate}
            hint="Leave empty for an open-ended challenge."
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="challenge-goal" className="block text-sm font-medium">
            How progress is measured
          </label>
          <select
            id="challenge-goal"
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as ChallengeGoalType)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          >
            {(Object.keys(GOAL_LABELS) as ChallengeGoalType[]).map((value) => (
              <option key={value} value={value}>
                {GOAL_LABELS[value].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">{GOAL_LABELS[goalType].hint}</p>
        </div>

        {goalType !== "manual" ? (
          <Field
            id="challenge-goal-target"
            label="Target"
            type="number"
            value={goalTarget}
            onChange={setGoalTarget}
            hint="The number of matching records that completes this challenge."
            required
          />
        ) : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-40"
          >
            {pending ? "Saving..." : challenge ? "Save changes" : "Create challenge"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** "2026-10-15" -> "15 Oct 2026", parsed as a plain calendar day. */
function formatKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
