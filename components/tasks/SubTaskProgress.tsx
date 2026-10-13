"use client";

// Progress bar for a task's checklist.
//
// Shows "2/5 done" next to a track whose fill is the completed fraction. The
// numbers are announced as text, not colour alone, so the meaning survives for
// screen readers and in grayscale.

export default function SubTaskProgress({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  if (total === 0) return null;

  // Guard against divide-by-zero and clamp, so a stale render can't overflow.
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = done === total;

  return (
    <div className="mt-2.5 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-muted">
          {done}/{total} done
        </span>
        {complete ? (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Checklist complete
          </span>
        ) : null}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} subtasks done`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-app"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${complete ? "bg-emerald-500" : "bg-accent"
            }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}