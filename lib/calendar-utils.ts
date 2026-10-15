import { todayKey } from "@/hooks/useTasks";
import type { Task } from "@/types";

// Calendar date maths and grid building, as pure functions.
//
// All date arithmetic works on YYYY-MM-DD keys through Date.UTC: the keys are
// calendar days with no time attached, so UTC keeps 31 Jan + 1 month and the
// 23:00-to-00:00 DST boundary from moving a day.

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Shifts a YYYY-MM-DD key by whole days. */
export function shiftDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Shifts a key by whole months, clamping the day to the target month's length.
 * Without the clamp, stepping from 31 January would overflow into March.
 */
export function shiftMonth(key: string, months: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const daysInTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTarget));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

/** Whole days between two keys (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

/** Weekday of a key, 0 = Sunday. */
export function weekdayOf(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export type GridDay = { date: string; inMonth: boolean };
export type CalendarGrid = {
  days: GridDay[];
  label: string;
  weekdayLabels: string[];
};

/** The weekday labels in the user's week order (Sunday or Monday first). */
function weekdayLabels(weekStart: number): string[] {
  const start = ((weekStart % 7) + 7) % 7;
  return Array.from({ length: 7 }, (_, index) => WEEKDAY_LABELS[(index + start) % 7]);
}

/**
 * Six weeks of cells covering the month around `anchor`.
 *
 * Always six rows. A month that fits in five still pads out, so the grid never
 * changes height as the user pages through months.
 */
export function monthGrid(anchor: string, weekStart: number): CalendarGrid {
  const [year, month] = anchor.split("-").map(Number);
  const firstOfMonth = `${anchor.slice(0, 7)}-01`;

  const start = ((weekStart % 7) + 7) % 7;
  const leading = (weekdayOf(firstOfMonth) - start + 7) % 7;
  const first = shiftDays(firstOfMonth, -leading);

  const days: GridDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = shiftDays(first, index);
    days.push({ date, inMonth: Number(date.slice(5, 7)) === month });
  }

  return {
    days,
    label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    }),
    weekdayLabels: weekdayLabels(weekStart),
  };
}

/** The seven days of the week containing `anchor`. */
export function weekGrid(anchor: string, weekStart: number): CalendarGrid {
  const start = ((weekStart % 7) + 7) % 7;
  const leading = (weekdayOf(anchor) - start + 7) % 7;
  const first = shiftDays(anchor, -leading);

  const days: GridDay[] = Array.from({ length: 7 }, (_, index) => ({
    date: shiftDays(first, index),
    inMonth: true,
  }));

  return {
    days,
    label: `${formatShortDay(first)} - ${formatShortDay(days[6].date)}`,
    weekdayLabels: weekdayLabels(weekStart),
  };
}

/**
 * The calendar day a task is shown on: its due date, or today when it has none.
 *
 * A task with no due date cannot honestly be placed on a calendar, so it floats
 * onto today's cell rather than disappearing from the whole view.
 */
export function taskDayKey(task: Task): string {
  if (!task.due_at) return todayKey();
  const date = new Date(task.due_at);
  if (Number.isNaN(date.getTime())) return todayKey();
  return todayKey(date);
}

/** "Tuesday, 14 October 2026". */
export function formatLongDay(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "14 Oct". */
export function formatShortDay(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Time of day from a stored UTC instant, rendered in the browser's timezone. */
export function formatTimeOfDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No time set";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
