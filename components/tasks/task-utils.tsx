"use client";

import {
  differenceInCalendarDays,
  format,
  formatDistanceStrict,
  isThisYear,
  isToday,
  isTomorrow,
} from "date-fns";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { Task } from "@/types";

// Priority badge. Colour carries meaning, so the label is always shown too -
// colour alone is not accessible.
// Low is neutral rather than green: green in a task list already means
// "completed", so using it for priority would overload the colour.
const PRIORITY_TONES: Record<Task["priority"], BadgeTone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  return (
    <Badge tone={PRIORITY_TONES[priority]} dot={priority !== "low"}>
      {PRIORITY_LABEL[priority]}
    </Badge>
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
