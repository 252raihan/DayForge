"use client";

import {
  differenceInCalendarDays,
  format,
  formatDistanceStrict,
  isThisYear,
  isToday,
  isTomorrow,
} from "date-fns";
import type { Task } from "@/types";

// Priority badge. Colour carries meaning, so the label is always shown too -
// colour alone is not accessible.
const PRIORITY_STYLES: Record<Task["priority"], string> = {
  high: "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  medium:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  low: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/**
 * Human-readable due date in the user's LOCAL timezone.
 * `due_at` is stored as a UTC instant; `new Date(...)` renders it locally, so
 * this is correct for the viewer regardless of where they are.
 *
 * Overdue tasks read as elapsed time ("Overdue by 2 days"); everything else
 * reads as a deadline ("Due today at 5:00 PM", "Due tomorrow", "Due Oct 14").
 */
export function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return "No due date";

  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "No due date";

  // Past due: show how long ago, in the largest sensible unit.
  if (date.getTime() < Date.now()) {
    return `Overdue by ${formatDistanceStrict(date, new Date())}`;
  }

  // Today keeps the precise time, since the hour still matters.
  if (isToday(date)) return `Due today at ${format(date, "h:mm a")}`;

  // Tomorrow reads better without a time attached.
  if (isTomorrow(date)) return "Due tomorrow";

  // Within the next week, name the weekday.
  const days = differenceInCalendarDays(date, new Date());
  if (days > 1 && days <= 7) return `Due ${format(date, "EEEE")}`;

  // Otherwise an explicit date; drop the year when it is the current one.
  return `Due ${format(date, isThisYear(date) ? "d MMM" : "d MMM yyyy")}`;
}
