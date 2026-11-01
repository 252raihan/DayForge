"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ChoiceChip,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  ProgressBar,
  LoadingRows,
  SegmentedControl,
  StatTile,
  TextareaField,
} from "@/components/ui";
import Modal from "@/components/tasks/Modal";
import {
  CheckIcon,
  EditIcon,
  FlameIcon,
  HabitsIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { HABIT_CHART_DAYS, isDoneToday, useHabits } from "@/hooks/useHabits";
import { dayWindow, isScheduledOn, weekdayOf } from "@/lib/habit-utils";
import { todayKey, WEEKDAY_LABELS } from "@/hooks/useTasks";
import type { Habit, HabitFrequency, HabitInsert, HabitStats } from "@/types";
import { cn } from "@/lib/cn";

// Habits: daily routines with a real, persisted history.
//
// A check-in is a dated row in `habit_logs` - not a checkbox on the habit - so
// a streak survives a reload, a missed day is real, and the 14-day strip can
// show exactly which days were done. Streaks are computed by walking backwards
// through those rows (see lib/habit-utils.ts).

export default function HabitsPage() {
  // The week view start comes from the user's saved preference.
  const [weekStart, setWeekStart] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function loadPreference() {
      const { getPreferencesFromBrowser } = await import("@/lib/preferences");
      const preferences = await getPreferencesFromBrowser();
      if (!cancelled && preferences) setWeekStart(preferences.week_start);
    }
    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    stats,
    todayStats,
    doneToday,
    includeArchived,
    setIncludeArchived,
    loading,
    error,
    reload,
    createHabit,
    updateHabit,
    deleteHabit,
    setCheckIn,
    busyId,
    setBusyId,
  } = useHabits(weekStart);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const active = stats.filter((item) => !item.habit.archived).length;
  const bestCurrentStreak = stats.reduce(
    (best, item) => Math.max(best, item.currentStreak),
    0,
  );

  async function handleToggleCheckIn(item: HabitStats) {
    const today = todayKey();
    const doneTodayAlready = isDoneToday(item, today);

    setBusyId(item.habit.id);
    setActionError(null);
    try {
      await setCheckIn(item.habit, !doneTodayAlready, today);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save this day.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Habits"
        description="Daily and weekly routines you want to repeat. Every check-in is saved for the day you made it, so streaks and history are real."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2} />
            New habit
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

      {!loading && active > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Habits" value={active} hint="Being tracked" />
          <StatTile
            label="Today"
            value={`${doneToday}/${todayStats.length}`}
            hint="Done today"
            tone={todayStats.length > 0 && doneToday === todayStats.length ? "success" : "default"}
          />
          <StatTile
            label="Best streak"
            value={bestCurrentStreak}
            hint="Days in a row"
            tone={bestCurrentStreak > 0 ? "success" : "default"}
          />
          <StatTile
            label="Total"
            value={stats.reduce((sum, item) => sum + item.totalCompletions, 0)}
            hint="Check-ins recorded"
          />
        </div>
      ) : null}

      {/* Today's check-in list: only the habits actually scheduled for today. */}
      {!loading && todayStats.length > 0 ? (
        <Card className="mb-4">
          <CardHeader
            title="Today's habits"
            icon={<CheckIcon className="h-4 w-4" />}
            description="Tap a row to check in — each check-in is saved for today."
            action={
              <Badge tone={doneToday === todayStats.length ? "success" : "neutral"} dot>
                {doneToday}/{todayStats.length} done
              </Badge>
            }
          />

          <div className="mb-3">
            <ProgressBar
              value={doneToday}
              max={todayStats.length}
              tone={doneToday === todayStats.length ? "success" : "accent"}
              label="Today's habit check-ins"
            />
          </div>

          <ul className="-mx-1 divide-y divide-border/70">
            {todayStats.map((item) => {
              const today = todayKey();
              const done = isDoneToday(item, today);
              return (
                <li key={item.habit.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-surface-2/60",
                      busyId === item.habit.id && "opacity-60",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Checkbox
                        checked={done}
                        disabled={busyId === item.habit.id}
                        onChange={() => handleToggleCheckIn(item)}
                        aria-label={`Mark "${item.habit.title}" done today`}
                      />
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-[13px] font-medium",
                            done ? "text-muted line-through" : "text-fg",
                          )}
                        >
                          {item.habit.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted">
                          {item.currentStreak > 0 ? (
                            <>
                              <FlameIcon className="h-3 w-3 text-amber-500" />
                              {item.currentStreak} day streak
                              <span aria-hidden="true">·</span>
                            </>
                          ) : null}
                          {item.completedLast7}/{item.targetLast7} in the last 7 days
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 text-2xs font-medium",
                        done
                          ? "border-transparent bg-surface-2 text-muted"
                          : "border-accent/30 bg-accent-soft text-accent",
                      )}
                      aria-hidden="true"
                    >
                      {done ? "Done" : "Check in"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-2xs leading-relaxed text-muted">
            Missed a day? Open a habit below and tick any day in the last two weeks —
            the history is stored per day, so it can be corrected.
          </p>
        </Card>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-fg">All habits</h2>
        <SegmentedControl
          ariaLabel="Habit visibility"
          value={includeArchived ? "all" : "active"}
          onChange={(value) => setIncludeArchived(value === "all")}
          options={[
            { value: "active", label: "Active" },
            { value: "all", label: "Include archived" },
          ]}
        />
      </div>

      {loading ? (
        <LoadingRows count={3} label="Loading habits" />
      ) : stats.length === 0 ? (
        <EmptyState
          icon={<HabitsIcon className="h-5 w-5" />}
          title={includeArchived ? "No habits yet" : "No active habits"}
          hint="Create a habit you want to keep, then check it off each day to build a streak."
          actionLabel="New habit"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {stats.map((item) => (
            <HabitCard
              key={item.habit.id}
              item={item}
              busy={busyId === item.habit.id}
              onToggleDay={(date, done) => setCheckIn(item.habit, done, date)}
              onToggleToday={() => handleToggleCheckIn(item)}
              onEdit={() => {
                setEditing(item.habit);
                setFormOpen(true);
              }}
              onDelete={() => setDeleting(item.habit)}
              onArchive={async () => {
                setBusyId(item.habit.id);
                setActionError(null);
                try {
                  await updateHabit(item.habit.id, { archived: !item.habit.archived });
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : "Could not update the habit.",
                  );
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </ul>
      )}

      <HabitFormModal
        open={formOpen}
        habit={editing}
        weekStart={weekStart}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) await updateHabit(editing.id, values);
          else await createHabit(values);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this habit?"
        description="Every check-in recorded for it is deleted too. This can't be undone."
        confirmLabel="Delete habit"
        onConfirm={async () => {
          if (!deleting) return;
          setBusyId(deleting.id);
          try {
            await deleteHabit(deleting.id);
            setDeleting(null);
          } finally {
            setBusyId(null);
          }
        }}
      >
        {deleting ? (
          <p className="mb-5 rounded-xl border border-border bg-app px-3.5 py-2.5 text-sm text-fg">
            {deleting.title}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

// One habit: schedule, streaks, the editable 14-day strip and the actions.
function HabitCard({
  item,
  busy,
  onToggleDay,
  onToggleToday,
  onEdit,
  onDelete,
  onArchive,
}: {
  item: HabitStats;
  busy: boolean;
  onToggleDay: (date: string, done: boolean) => Promise<void>;
  onToggleToday: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const { habit, currentStreak: streak, bestStreak, dueToday } = item;
  const today = todayKey();

  // The last 14 days, oldest first, so the strip reads left-to-right as time.
  const days = dayWindow(HABIT_CHART_DAYS, today);
  const doneByDate = new Map(
    item.recent
      .filter((log): log is NonNullable<typeof log> => log !== null)
      .map((log) => [log.log_date, log]),
  );

  return (
    <Card
      as="li"
      className={`flex flex-col ${busy ? "opacity-60" : ""} ${
        habit.archived ? "border-dashed bg-surface-2/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[13.5px] font-semibold text-fg">{habit.title}</h3>
            {habit.archived ? <Badge tone="neutral">Archived</Badge> : null}
            {!dueToday && !habit.archived ? (
              <Badge tone="neutral">Not today</Badge>
            ) : null}
          </div>

          {habit.description ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
              {habit.description}
            </p>
          ) : null}

          <p className="mt-1.5 text-2xs text-muted">
            {scheduleLabel(habit)}
            {item.missedLastWeek ? (
              <span className="text-amber-600 dark:text-amber-400"> · last week fell short</span>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            disabled={busy}
            aria-label={`Edit "${habit.title}"`}
          >
            <EditIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onArchive}
            disabled={busy}
            aria-label={habit.archived ? `Unarchive "${habit.title}"` : `Archive "${habit.title}"`}
            title={habit.archived ? "Unarchive" : "Archive"}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
              <path d="M10 12h4" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete "${habit.title}"`}
            className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Streak summary: the headline streak, then the lifetime figures. */}
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            streak > 0
              ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
              : "bg-surface text-muted",
          )}
          aria-hidden="true"
        >
          <FlameIcon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tabular-nums text-fg">
            {streak > 0 ? `${streak} day streak` : "No current streak"}
          </p>
          <p className="text-2xs text-muted">
            Best {bestStreak} · {item.totalCompletions} check-ins total
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[13px] font-semibold tabular-nums text-fg">
            {item.completedThisWeek}/{item.targetThisWeek}
          </p>
          <p className="text-2xs text-muted">this week</p>
        </div>
      </div>

      {/* Weekly completion: this week's progress against the schedule target. */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-2xs text-muted">
          <span>This week</span>
          <span className="tabular-nums sm:hidden">
            {item.completedThisWeek}/{item.targetThisWeek}
          </span>
        </div>
        <ProgressBar
          value={item.completedThisWeek}
          max={Math.max(item.targetThisWeek, 1)}
          tone={
            item.targetThisWeek > 0 && item.completedThisWeek >= item.targetThisWeek
              ? "success"
              : "accent"
          }
          label={`${habit.title} progress this week`}
        />
      </div>

      {/* The editable strip: each square is one real, persisted day. */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-2xs text-muted">Last {HABIT_CHART_DAYS} days</p>
          <p className="text-2xs text-muted/80">tap a day to correct it</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {days.map((date) => {
            const log = doneByDate.get(date);
            const done = Boolean(log);
            const scheduled = isScheduledOn(habit, date);
            const label = `${formatDayLabel(date)}: ${
              done ? "done" : scheduled ? "not done" : "not scheduled"
            }`;

            return (
              <button
                key={date}
                type="button"
                disabled={busy}
                onClick={() => onToggleDay(date, !done)}
                title={label}
                aria-label={label}
                aria-pressed={done}
                className={cn(
                  "h-7 w-7 rounded-md border text-3xs font-semibold transition-colors disabled:cursor-not-allowed",
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : scheduled
                      ? "border-border bg-surface text-muted hover:border-emerald-400 hover:text-emerald-600"
                      : "border-dashed border-border/80 bg-transparent text-muted/50",
                )}
              >
                {WEEKDAY_LABELS[weekdayOf(date)].charAt(0)}
              </button>
            );
          })}
        </div>
      </div>

      {dueToday && !habit.archived ? (
        <div className="mt-auto pt-3">
          <Button
            variant="success"
            size="sm"
            active={Boolean(doneByDate.get(today))}
            onClick={onToggleToday}
            disabled={busy}
            aria-pressed={Boolean(doneByDate.get(today))}
            className="h-8 w-full"
          >
            {doneByDate.get(today) ? (
              <>
                <CheckIcon className="h-4 w-4" />
                Done today
              </>
            ) : (
              "Mark done today"
            )}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

// Create / edit dialog.
function HabitFormModal({
  open,
  habit,
  weekStart,
  onClose,
  onSubmit,
}: {
  open: boolean;
  habit: Habit | null;
  weekStart: number;
  onClose: () => void;
  onSubmit: (values: HabitInsert) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [days, setDays] = useState<number[]>([]);
  const [targetPerWeek, setTargetPerWeek] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // Seeded once per opening, keyed so re-opening the same habit re-seeds.
  const key = `${open ? "open" : "closed"}:${habit?.id ?? "new"}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    setTitle(habit?.title ?? "");
    setDescription(habit?.description ?? "");
    setFrequency(habit?.frequency ?? "daily");
    setDays(habit?.habit_days ?? []);
    setTargetPerWeek(habit?.target_per_week ? String(habit.target_per_week) : "3");
    setError(null);
    setPending(false);
  }
  if (!open && seededFor !== null) setSeededFor(null);

  // Weekday buttons in the user's week order (Sunday or Monday first).
  const weekdayOrder = Array.from({ length: 7 }, (_, index) => (index + weekStart) % 7);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Give the habit a title.");
      return;
    }
    if (trimmedTitle.length > 120) {
      setError("That title is too long (120 characters max).");
      return;
    }
    if (frequency === "weekly" && days.length === 0) {
      setError("Pick at least one day, or choose a different frequency.");
      return;
    }

    const parsedTarget = Number(targetPerWeek);
    if (
      frequency === "custom" &&
      (!Number.isInteger(parsedTarget) || parsedTarget < 1 || parsedTarget > 7)
    ) {
      setError("Times per week must be a whole number from 1 to 7.");
      return;
    }

    setPending(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
        frequency,
        // The column is NULL unless the frequency is `weekly`, matching the
        // database check constraint.
        habit_days: frequency === "weekly" ? days : null,
        target_per_week: frequency === "custom" ? parsedTarget : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the habit.");
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
      description="How often do you want to do this? Streaks use whichever days you pick."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <Alert onDismiss={() => setError(null)}>{error}</Alert> : null}

        <Field
          id="habit-title"
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. Read for 30 minutes"
          required
        />

        <TextareaField
          id="habit-description"
          label="Description"
          optional
          value={description}
          onChange={setDescription}
          rows={2}
        />

        <fieldset className="space-y-1.5">
          <legend className="block text-sm font-medium text-fg">Frequency</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "daily", label: "Every day" },
                { value: "weekly", label: "Specific days" },
                { value: "custom", label: "Times per week" },
              ] as { value: HabitFrequency; label: string }[]
            ).map((option) => (
              <ChoiceChip
                key={option.value}
                selected={frequency === option.value}
                onClick={() => setFrequency(option.value)}
              >
                {option.label}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>

        {frequency === "weekly" ? (
          <fieldset>
            <legend className="mb-1.5 text-xs text-muted">Which days?</legend>
            <div className="flex flex-wrap gap-1.5">
              {weekdayOrder.map((day) => {
                const selected = days.includes(day);
                return (
                  <ChoiceChip
                    key={day}
                    selected={selected}
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() =>
                      setDays((prev) =>
                        prev.includes(day)
                          ? prev.filter((value) => value !== day)
                          : [...prev, day].sort((a, b) => a - b),
                      )
                    }
                  >
                    {WEEKDAY_LABELS[day]}
                  </ChoiceChip>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {frequency === "custom" ? (
          <Field
            id="habit-target"
            label="Times per week"
            type="number"
            value={targetPerWeek}
            onChange={setTargetPerWeek}
            hint="Any days count - the streak follows the days you actually do it."
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
            {habit ? "Save changes" : "Create habit"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** "Every day", "Mon, Wed, Fri" or "3 times a week". */
function scheduleLabel(habit: Habit): string {
  if (habit.frequency === "weekly") {
    const labels = (habit.habit_days ?? [])
      .slice()
      .sort((a, b) => a - b)
      .map((day) => WEEKDAY_LABELS[day]);
    return labels.length > 0 ? labels.join(", ") : "No days selected";
  }
  if (habit.frequency === "custom") {
    return `${habit.target_per_week ?? 1} times a week`;
  }
  return "Every day";
}

/** "Tue 14 Oct" for the strip's tooltip. */
function formatDayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

