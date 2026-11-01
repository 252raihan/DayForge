"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/tasks/Modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingRows,
  ProgressBar,
  SelectField,
  StatTile,
  TextareaField,
} from "@/components/ui";
import {
  ChallengesIcon,
  CheckIcon,
  EditIcon,
  FlameIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
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

  return (
    <>
      <PageHeader
        title="Challenges"
        description="Time-boxed goals and streaks to keep your study routine on track. Progress is counted from your real task, habit and check-in records."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2} />
            New challenge
          </Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <Alert onDismiss={() => setActionError(null)}>{actionError}</Alert>
        </div>
      ) : null}

      {!loading && progress.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          icon={<ChallengesIcon className="h-5 w-5" />}
          title="No challenges yet"
          hint="Set a time-boxed goal, then let DayForge count your progress for you from real task, habit and check-in records."
          actionLabel="New challenge"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
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
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this challenge?"
        description="Its check-in history is removed with it. This can't be undone."
        confirmLabel="Delete challenge"
        onConfirm={async () => {
          if (!deleting) return;
          setBusyId(deleting.id);
          try {
            await deleteChallenge(deleting.id);
            setDeleting(null);
          } finally {
            setBusyId(null);
          }
        }}
      >
        {deleting ? (
          <p className="mb-5 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg">
            {deleting.title}
          </p>
        ) : null}
      </ConfirmDialog>
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

  const statusTones: Record<
    typeof status,
    "accent" | "success" | "warning" | "neutral"
  > = {
    active: "accent",
    completed: "success",
    expired: "warning",
    not_started: "neutral",
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
    <Card
      as="li"
      className={`flex flex-col ${busy ? "opacity-60" : ""} ${
        status === "completed" ? "border-emerald-200/70 dark:border-emerald-900/60" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[13.5px] font-semibold text-fg">{challenge.title}</h3>
            <Badge tone={statusTones[status]} dot>
              {statusLabels[status]}
            </Badge>
          </div>

          {challenge.description ? (
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
              {challenge.description}
            </p>
          ) : null}

          <p className="mt-1.5 text-2xs tabular-nums text-muted">
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

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            disabled={busy}
            aria-label={`Edit "${challenge.title}"`}
          >
            <EditIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete "${challenge.title}"`}
            className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress. The bar is only drawn when there is a real target. */}
      {target !== null ? (
        <div className="mt-3.5">
          <div className="mb-1.5 flex items-end justify-between gap-2">
            <span className="text-2xs text-muted">{goal.label}</span>
            <span className="text-right">
              <span className="text-xl font-semibold leading-none tabular-nums text-fg">
                {percent}%
              </span>
              <span className="ml-1.5 text-2xs tabular-nums text-muted">
                {current}/{target}
              </span>
            </span>
          </div>
          <ProgressBar
            value={percent ?? 0}
            tone={
              status === "completed"
                ? "success"
                : status === "expired"
                  ? "warning"
                  : "accent"
            }
            label={`${challenge.title} progress`}
            height="h-2"
          />
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-2xs leading-relaxed text-muted">
          {goal.label}: nothing to count for this challenge. Edit it to add a goal type
          and target.
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <p className="flex min-w-0 items-center gap-1.5 text-2xs text-muted">
          {streak !== null && checkinDates.length > 0 ? (
            <>
              <FlameIcon className="h-3 w-3 shrink-0 text-amber-500" />
              <span className="truncate">
                Longest run {streak} day{streak === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="truncate">{goal.hint}</span>
          )}
        </p>

        {challenge.goal_type === "checkin_count" ? (
          <Button
            variant="success"
            size="sm"
            active={checkedInToday}
            onClick={onCheckIn}
            disabled={busy}
            aria-pressed={checkedInToday}
            className="h-8 shrink-0"
          >
            {checkedInToday ? (
              <>
                <CheckIcon className="h-4 w-4" />
                Checked in
              </>
            ) : (
              "Check in"
            )}
          </Button>
        ) : null}
      </div>
    </Card>
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
        {error ? <Alert onDismiss={() => setError(null)}>{error}</Alert> : null}

        <Field
          id="challenge-title"
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. 30 days of revision"
          required
        />

        <TextareaField
          id="challenge-description"
          label="Description"
          optional
          value={description}
          onChange={setDescription}
          rows={3}
        />

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

        <SelectField
          id="challenge-goal"
          label="How progress is measured"
          value={goalType}
          onChange={(value) => setGoalType(value as ChallengeGoalType)}
          hint={GOAL_LABELS[goalType].hint}
        >
          {(Object.keys(GOAL_LABELS) as ChallengeGoalType[]).map((value) => (
            <option key={value} value={value}>
              {GOAL_LABELS[value].label}
            </option>
          ))}
        </SelectField>

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
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={pending}
            loadingLabel="Saving..."
            className="w-full sm:w-40"
          >
            {challenge ? "Save changes" : "Create challenge"}
          </Button>
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
