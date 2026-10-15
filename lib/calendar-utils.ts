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
  const month = Number(anchor.slice(5, 7));
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
    label: `${MONTH_LABELS[monthIndex(firstOfMonth)]} ${yearOf(firstOfMonth)}`,
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

/**
 * Deterministic month labels. `toLocaleDateString(undefined, ...)` resolves to
 * the environment's DEFAULT locale, which differs between the Node server and
 * the browser (Node may give "October" in en-GB month order while a browser
 * set to en-US still says "October" but can differ for short forms like
 * "Sept" vs "Sep") - that mismatch is the documented hydration error.
 * Hard-coding the names removes ICU/locale entirely from the output.
 */
export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Short month names for the compact axis labels, 0-indexed like Date. */
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "2026-10-14" -> 9 (October, 0-indexed). Pure string parsing, no Date. */
function monthIndex(key: string): number {
  return Number(key.slice(5, 7)) - 1;
}

/** "2026-10-14" -> 14. */
function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10));
}

/** "2026-10-14" -> "2026". */
function yearOf(key: string): string {
  return key.slice(0, 4);
}

/** "Tuesday, 14 October 2026" - fixed order, fixed names, every environment. */
export function formatLongDay(key: string): string {
  return `${WEEKDAY_FULL[weekdayOf(key)]}, ${dayOfMonth(key)} ${MONTH_LABELS[monthIndex(key)]} ${yearOf(key)}`;
}

/** Full weekday names, 0-indexed like WEEKDAY_LABELS, for formatLongDay. */
const WEEKDAY_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

/** "14 Oct" - fixed order (day before month), fixed names, every environment. */
export function formatShortDay(key: string): string {
  return `${dayOfMonth(key)} ${MONTHS_SHORT[monthIndex(key)]}`;
}

/** Time of day from a stored UTC instant, rendered in the browser's timezone. */
export function formatTimeOfDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No time set";
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  // Fixed 12-hour formatting: ICU would render the same hour differently
  // between environments ("3 pm" vs "3 PM" vs "15:00"), so it is spelled out.
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  const suffix = hours < 12 ? "am" : "pm";
  return `${twelve}:${minutes} ${suffix}`;
}
