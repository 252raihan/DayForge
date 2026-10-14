"use client";

import { recentDayKeys, alignHistoryToDays } from "@/hooks/useTasks";
import type { DailyPoint } from "@/types";

// A compact daily-completion bar chart, one bar per calendar day.
//
//   green = "Yes" (completed)   red = "No" (not completed)   grey = not answered
//
// Colour is never the only signal: every bar carries a title/aria-label naming
// the day and the status, so the chart still reads for colour-blind users and
// in a screen reader. Kept dependency-free (plain divs) rather than pulling in a
// charting library: the data is one boolean per day, so a flex row of bars is
// both simpler and sharper than an SVG canvas.
export default function CompletionChart({
  history,
  dayCount = 14,
  height = "h-20",
  label = "Daily completion",
  showAxis = true,
}: {
  /** The task's logged days, oldest first. Missing days render as "not answered". */
  history: DailyPoint[];
  /** How many recent days to plot. The window always ends today. */
  dayCount?: number;
  /** Tailwind height class for the bar area. */
  height?: string;
  /** Accessible name for the chart as a whole. */
  label?: string;
  /** Show the first/last date under the chart. */
  showAxis?: boolean;
}) {
  const dayKeys = recentDayKeys(dayCount);
  const aligned = alignHistoryToDays(history, dayKeys);

  // A day with no log is neither a success nor a miss, so it gets its own muted
  // treatment rather than being counted either way.
  const answered = aligned.filter((point): point is DailyPoint => point !== null);
  const yes = answered.filter((point) => point.completed).length;
  const total = answered.length;
  const rate = total === 0 ? 0 : Math.round((yes / total) * 100);

  return (
    <div>
      <div
        role="img"
        aria-label={`${label}: ${yes} of ${total} tracked days completed (${rate}%).`}
        className={`flex items-end gap-1 ${height}`}
      >
        {aligned.map((point, index) => {
          const date = dayKeys[index];
          const short = shortDay(date);
          const title = point
            ? `${short}: ${point.completed ? "Yes, completed" : "No, missed"}`
            : `${short}: not answered`;

          const tone = !point
            ? "bg-border"
            : point.completed
              ? "bg-emerald-500"
              : "bg-red-500";

          // Unanswered days are shown as a faint stub so the gap is visible but
          // obviously different from a red "No".
          const fill = point ? "h-full" : "h-1.5";

          return (
            <div
              key={date}
              title={title}
              className="flex h-full flex-1 items-end"
            >
              <div
                className={`w-full rounded-sm transition-colors ${tone} ${fill}`}
                aria-hidden="true"
              />
              <span className="sr-only">{title}</span>
            </div>
          );
        })}
      </div>

      {showAxis ? (
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
          <span>{shortDay(dayKeys[0])}</span>
          <span>Today</span>
        </div>
      ) : null}
    </div>
  );
}

/** "2026-10-14" -> "14 Oct" (parsed as local, not UTC). */
function shortDay(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
