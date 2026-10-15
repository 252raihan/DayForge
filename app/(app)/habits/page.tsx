"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/tasks/Modal";
import { EmptyState, ErrorBanner, LoadingRows, StatTile } from "@/components/ui";
import { Field, FormMessage } from "@/components/ui/Form";
import { HABIT_CHART_DAYS, useHabits } from "@/hooks/useHabits";
import { dayWindow, isScheduledOn, weekdayOf } from "@/lib/habit-utils";
import { todayKey, WEEKDAY_LABELS } from "@/hooks/useTasks";
import type { Habit, HabitFrequency, HabitInsert, HabitStats } from "@/types";

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
    const doneTodayAlready = item.recent[HABIT_CHART_DAYS - 1]?.log_date === today;

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

  async function handleDelete(habit: Habit) {
    setBusyId(habit.id);
    setActionError(null);
    try {
      await deleteHabit(habit.id);
      setDeleting(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not delete the habit.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Habits"
          description="Daily and weekly routines you want to repeat. Every check-in is saved for the day you made it, so streaks and history are real."
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
          New habit
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

      {!loading && active > 0 ? (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <section className="mb-5 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Today&apos;s habits</h2>
            <p className="text-xs text-muted">
              {doneToday}/{todayStats.length} done
            </p>
          </div>

          <ul className="space-y-2">
            {todayStats.map((item) => {
              const today = todayKey();
              const done = item.recent[HABIT_CHART_DAYS - 1]?.log_date === today;
              return (
                <li
                  key={item.habit.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-border bg-app px-3.5 py-2.5 ${
                    busyId === item.habit.id ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.habit.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {item.currentStreak > 0
                        ? `${item.currentStreak} day streak · `
                        : ""}
                      {item.completedLast7}/{item.targetLast7} in the last 7 days
                    </p>
                  </div>

                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={busyId === item.habit.id}
                      onChange={() => handleToggleCheckIn(item)}
                      aria-label={`Mark "${item.habit.title}" done today`}
                      style={{ height: "1.25rem", width: "1.25rem" }}
                      className="cursor-pointer rounded border-border accent-[rgb(var(--accent))]"
                    />
                    {done ? "Done" : "Not yet"}
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-xs text-muted">
            Missed a day? Open a habit below and tick any day in the last two weeks -
            the history is stored per day, so it can be corrected.
          </p>
        </section>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">All habits</h2>
        <button
          type="button"
          onClick={() => setIncludeArchived((prev) => !prev)}
          aria-pressed={includeArchived}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
            includeArchived
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-muted hover:bg-accent-soft/60 hover:text-accent"
          }`}
        >
          {includeArchived ? "Showing archived" : "Show archived"}
        </button>
      </div>

      {loading ? (
        <LoadingRows count={3} label="Loading habits" />
      ) : stats.length === 0 ? (
        <EmptyState
          title={includeArchived ? "No habits yet" : "No active habits"}
          hint="Create a habit you want to keep, then check it off each day to build a streak."
          actionLabel="New habit"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="space-y-3">
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

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this habit?"
        description="Every check-in recorded for it is deleted too. This can't be undone."
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
            Delete habit
          </button>
        </div>
      </Modal>
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
    <li
      className={`rounded-2xl border border-border bg-surface p-4 ${
        busy ? "opacity-60" : ""
      } ${habit.archived ? "border-dashed" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{habit.title}</h3>
            {habit.archived ? (
              <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-semibold text-muted">
                Archived
              </span>
            ) : null}
            {!dueToday && !habit.archived ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                Not scheduled today
              </span>
            ) : null}
          </div>

          {habit.description ? (
            <p className="mt-1 text-sm text-muted">{habit.description}</p>
          ) : null}

          <p className="mt-1.5 text-xs text-muted">
            {scheduleLabel(habit)} · {item.completedThisWeek}/{item.targetThisWeek} this week
            {item.missedLastWeek ? " · last week fell short" : ""}
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
            onClick={onArchive}
            disabled={busy}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
          >
            {habit.archived ? "Unarchive" : "Archive"}
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

      {/* Streaks, all derived from stored check-ins. */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="font-semibold">
          {streak > 0 ? `${streak} day streak` : "No current streak"}
        </span>
        <span className="text-muted">Best: {bestStreak} days</span>
        <span className="text-muted">Total: {item.totalCompletions} check-ins</span>
      </div>

      {/* The editable strip: each square is one real, persisted day. */}
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] text-muted">
          Last {HABIT_CHART_DAYS} days - tick a day to correct it
        </p>
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
                className={`h-7 w-7 rounded-md border text-[10px] font-semibold transition-colors disabled:cursor-not-allowed ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : scheduled
                      ? "border-border text-muted hover:border-emerald-400"
                      : "border-dashed border-border text-muted/50"
                }`}
              >
                {weekdayOf(date) === 0
                  ? WEEKDAY_LABELS[0].charAt(0)
                  : WEEKDAY_LABELS[weekdayOf(date)].charAt(0)}
              </button>
            );
          })}
        </div>
      </div>

      {dueToday && !habit.archived ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={onToggleToday}
            disabled={busy}
            aria-pressed={Boolean(doneByDate.get(today))}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
              doneByDate.get(today)
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            }`}
          >
            {doneByDate.get(today) ? "Done today" : "Mark done today"}
          </button>
        </div>
      ) : null}
    </li>
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
        {error ? <FormMessage>{error}</FormMessage> : null}

        <Field
          id="habit-title"
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. Read for 30 minutes"
          required
        />

        <div className="space-y-1.5">
          <label htmlFor="habit-description" className="block text-sm font-medium">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="habit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="block text-sm font-medium">Frequency</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "daily", label: "Every day" },
                { value: "weekly", label: "Specific days" },
                { value: "custom", label: "Times per week" },
              ] as { value: HabitFrequency; label: string }[]
            ).map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  frequency === option.value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:bg-accent-soft/50"
                }`}
              >
                <input
                  type="radio"
                  name="habit-frequency"
                  value={option.value}
                  checked={frequency === option.value}
                  onChange={() => setFrequency(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
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
                  <label
                    key={day}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted hover:bg-accent-soft/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      onChange={() =>
                        setDays((prev) =>
                          prev.includes(day)
                            ? prev.filter((value) => value !== day)
                            : [...prev, day].sort((a, b) => a - b),
                        )
                      }
                    />
                    {WEEKDAY_LABELS[day]}
                  </label>
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
            {pending ? "Saving..." : habit ? "Save changes" : "Create habit"}
          </button>
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

