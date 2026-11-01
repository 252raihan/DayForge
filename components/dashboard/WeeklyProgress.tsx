"use client";

import { formatShortDay } from "@/lib/calendar-utils";

// Weekly progress: one column per day, oldest first, ending today.
//
// Height is the answered-completion percentage for that day; a day with no
// answers is drawn as a dashed stub rather than a zero bar, because "not
// answered" is a gap and not a miss. Every column carries its real numbers in
// a tooltip and in visually-hidden text, so the chart is not colour-only.
//
// Dependency-free (plain divs) - the data is one number per day, so an SVG
// library would add weight without adding meaning.

type Point = {
  date: string;
  total: number;
  yes: number;
  no: number;
  answered: number;
  percent: number | null;
};

function toneFor(percent: number | null): string {
  if (percent === null) return "bg-border";
  if (percent >= 70) return "bg-emerald-500";
  if (percent >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default function WeeklyProgress({
  points,
  windowPercent,
  label = "Weekly completion",
}: {
  /** Up to seven daily points, oldest first. */
  points: Point[];
  /** Completion across every answered day in the window, or null. */
  windowPercent: number | null;
  label?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <p className="tabular-nums text-2xs text-muted">
          {windowPercent === null ? "No answers yet" : `${windowPercent}% this week`}
        </p>
      </div>

      <div
        role="img"
        aria-label={`Weekly completion: ${windowPercent === null ? "no answers recorded" : `${windowPercent}% across answered days`
          }.`}
        className="mt-3 flex h-28 items-end gap-1.5 sm:gap-2"
      >
        {points.map((point) => {
          const answered = point.percent !== null;
          const height = answered ? Math.max(point.percent ?? 0, 4) : 0;

          return (
            <div key={point.date} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div className="group relative flex h-full flex-col justify-end">
                {/* Track */}
                <div className="absolute inset-0 rounded-md bg-surface-2" aria-hidden="true" />

                {answered ? (
                  <div
                    className={`relative w-full rounded-md transition-[height] duration-500 ease-smooth ${toneFor(
                      point.percent,
                    )}`}
                    style={{ height: `${height}%` }}
                    aria-hidden="true"
                  />
                ) : (
                  <div
                    className="relative mx-auto mb-1 h-1.5 w-2/3 rounded-full border border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                )}

                {/* Hover readout */}
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-3xs font-medium text-fg shadow-overlay group-hover:block">
                  {formatShortDay(point.date)} ·{" "}
                  {answered
                    ? `${point.percent}% (${point.yes}/${point.answered})`
                    : "not answered"}
                </span>
              </div>

              <p className="mt-1.5 truncate text-center text-3xs text-muted">
                {new Date(`${point.date}T00:00`).toLocaleDateString(undefined, {
                  weekday: "narrow",
                })}
              </p>
              <span className="sr-only">
                {formatShortDay(point.date)}:{" "}
                {answered
                  ? `${point.percent} percent, ${point.yes} of ${point.answered} answered yes`
                  : "not answered"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
