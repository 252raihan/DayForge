import { todayKey } from "@/hooks/useTasks";
import type { Habit, HabitFrequency, HabitLog, HabitStats } from "@/types";

// Habit streaks and schedule maths, as pure functions.
//
// The rule that matters: a streak is computed by walking BACKWARDS through
// persisted, date-specific check-ins - never from the current checkbox state.
// The number of days a habit is "answerable" comes from its schedule, and a day
// that is not answerable is skipped rather than counted as a miss.
//
// All of this is pure so tests/habits.test.mjs can assert it directly.

/** Whole days between two YYYY-MM-DD keys (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** Adds whole days to a YYYY-MM-DD key, in UTC so no DST boundary can shift it. */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Weekday of a YYYY-MM-DD key, 0 = Sunday. */
export function weekdayOf(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The last `count` day keys ending at `end`, oldest first. */
export function dayWindow(count: number, end: string = todayKey()): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(addDays(end, -offset));
  }
  return keys;
}

/**
 * True when the habit is meant to be done on the given weekday.
 *
 *   daily  → every day
 *   weekly → only the selected weekdays
 *   custom → any day (the target is a weekly count, not a fixed schedule)
 */
export function isScheduledOn(habit: Habit, key: string): boolean {
  const frequency: HabitFrequency = habit.frequency ?? "daily";

  if (frequency === "weekly") {
    const days = habit.habit_days ?? [];
    // A weekly habit with no days picked would otherwise never be due, so fall
    // back to "every day" rather than silently hiding it.
    if (days.length === 0) return true;
    return days.includes(weekdayOf(key));
  }

  return true;
}

/** True when the habit should be answered today, per its schedule. */
export function isDueToday(habit: Habit, today: string = todayKey()): boolean {
  return isScheduledOn(habit, today);
}

/** First and last day keys of the week containing `key`. */
export function weekBounds(key: string, weekStart: number): { start: string; end: string } {
  const start = ((weekStart % 7) + 7) % 7;
  const current = weekdayOf(key);
  const offset = (current - start + 7) % 7;
  const first = addDays(key, -offset);
  return { start: first, end: addDays(first, 6) };
}

/**
 * Current streak: consecutive scheduled days leading back from `today` that
 * have a check-in.
 *
 * Two deliberate rules:
 *   - A scheduled day that is NOT yet answered does not break the streak while
 *     the day is still running (today itself is always treated as neutral), so
 *     a user who has not opened the app yet sees yesterday's streak intact.
 *   - Days the habit is not scheduled for are skipped entirely rather than
 *     counted as misses, which is what makes a Mon/Wed/Fri habit behave.
 */
export function currentStreak(
  habit: Habit,
  checkedDates: Set<string>,
  today: string = todayKey(),
): number {
  let streak = 0;

  // One year is the cap: beyond that the answer is "long" and the loop cost is
  // not worth it.
  for (let offset = 0; offset < 366; offset += 1) {
    const key = addDays(today, -offset);

    if (!isScheduledOn(habit, key)) continue;

    if (checkedDates.has(key)) {
      streak += 1;
      continue;
    }

    // An unanswered scheduled day today is neutral; any earlier unanswered
    // scheduled day ends the streak.
    if (key === today) continue;

    break;
  }

  return streak;
}

/**
 * Best streak ever: the longest run of consecutive scheduled days that were
 * checked in. Walks forward from the habit's creation date so the whole
 * recorded history is considered.
 */
export function bestStreak(habit: Habit, checkedDates: Set<string>): number {
  if (checkedDates.size === 0) return 0;

  const created = habit.created_at.slice(0, 10);
  const sorted = Array.from(checkedDates).sort((a, b) => a.localeCompare(b));
  const first = sorted[0] > created ? sorted[0] : created;
  const last = sorted[sorted.length - 1];

  let best = 0;
  let run = 0;
  let key = first;

  // Guarded by the day count, not by comparing dates in the loop condition, so
  // a malformed date cannot spin forever.
  const totalDays = daysBetween(first, last);
  for (let index = 0; index <= totalDays; index += 1) {
    if (isScheduledOn(habit, key)) {
      if (checkedDates.has(key)) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    key = addDays(key, 1);
  }

  return best;
}

/** Check-ins inside the week containing `today`, and the week's target. */
export function weeklyProgress(
  habit: Habit,
  checkedDates: Set<string>,
  weekStart: number,
  today: string = todayKey(),
): { completed: number; target: number; start: string; end: string } {
  const { start, end } = weekBounds(today, weekStart);
  const days = dayWindow(daysBetween(start, end) + 1, end);

  let completed = 0;
  for (const key of days) {
    if (checkedDates.has(key)) completed += 1;
  }

  // daily = 7 days; weekly = the number of selected weekdays; custom = its own
  // per-week target.
  let target = 7;
  if (habit.frequency === "weekly") {
    target = (habit.habit_days ?? []).length || 7;
  } else if (habit.frequency === "custom") {
    target = habit.target_per_week ?? 7;
  }

  return { completed, target, start, end };
}

/** True when the previous week finished short of its target. */
export function missedLastWeek(
  habit: Habit,
  checkedDates: Set<string>,
  weekStart: number,
  today: string = todayKey(),
): boolean {
  const { start } = weekBounds(today, weekStart);
  const lastWeekEnd = addDays(start, -1);
  const lastWeekStart = addDays(lastWeekEnd, -6);

  const days = dayWindow(7, lastWeekEnd);
  let completed = 0;
  for (const key of days) {
    if (key >= lastWeekStart && checkedDates.has(key)) completed += 1;
  }

  let target = 7;
  if (habit.frequency === "weekly") {
    target = (habit.habit_days ?? []).length || 7;
  } else if (habit.frequency === "custom") {
    target = habit.target_per_week ?? 7;
  }

  return completed < target;
}

/**
 * Builds every number a habit card shows, from the persisted check-ins and the
 * habit's own schedule.
 */
export function buildHabitStats(
  habit: Habit,
  logs: HabitLog[],
  weekStart: number,
  chartDays: number,
  today: string = todayKey(),
): HabitStats {
  const checkedDates = new Set(logs.filter((log) => log.done).map((log) => log.log_date));

  // The chart window, oldest first. A day with no check-in is null rather than
  // false, so "not done" and "not scheduled / not answered" stay distinguishable.
  const window = dayWindow(chartDays, today);
  const byDate = new Map(logs.map((log) => [log.log_date, log]));
  const recent = window.map((key) => byDate.get(key) ?? null);

  const week = weeklyProgress(habit, checkedDates, weekStart, today);

  const last7 = dayWindow(7, today);
  const completedLast7 = last7.filter((key) => checkedDates.has(key)).length;

  return {
    habit,
    dueToday: isDueToday(habit, today),
    missedLastWeek: missedLastWeek(habit, checkedDates, weekStart, today),
    currentStreak: currentStreak(habit, checkedDates, today),
    bestStreak: bestStreak(habit, checkedDates),
    completedLast7,
    targetLast7: week.target,
    completedThisWeek: week.completed,
    targetThisWeek: week.target,
    totalCompletions: checkedDates.size,
    recent,
  };
}
