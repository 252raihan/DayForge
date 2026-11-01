"use client";

import { Card, CardHeader, CardLink, EmptyState, LoadingRows } from "@/components/ui";
import { HabitsIcon, FlameIcon, PlusIcon } from "@/components/icons";
import { isDoneToday, useHabits } from "@/hooks/useHabits";
import { todayKey } from "@/hooks/useTasks";
import { cn } from "@/lib/cn";
import type { HabitStats } from "@/types";

// Habit streak overview on the dashboard.
//
// Same data layer as /habits (`useHabits`), so a streak shown here is the
// streak computed from the persisted check-ins - never a second calculation.
// Only the habits scheduled for today are listed, with today's check-in as a
// direct toggle, because that is the only action worth taking from a summary.

const MAX_HABITS = 4;

export default function DashboardHabits({ weekStart }: { weekStart: number }) {
  const { todayStats, doneToday, loading, error, busyId, setBusyId, setCheckIn } =
    useHabits(weekStart);

  const visible = todayStats.slice(0, MAX_HABITS);
  const today = todayKey();

  async function toggle(item: HabitStats) {
    setBusyId(item.habit.id);
    try {
      await setCheckIn(item.habit, !isDoneToday(item, today), today);
    } catch {
      // The list refetches on the next load; the Habits page shows the message.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Habits"
        icon={<HabitsIcon className="h-4 w-4" />}
        description={
          todayStats.length === 0
            ? "Nothing scheduled today"
            : `${doneToday} of ${todayStats.length} done today`
        }
        action={<CardLink href="/habits">All habits</CardLink>}
      />

      {loading ? (
        <LoadingRows count={2} label="Loading habits" />
      ) : error ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
          Could not load habits right now.
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<FlameIcon className="h-5 w-5" />}
          title="No habits yet"
          hint="Add a daily routine and build a streak from real check-ins."
          href="/habits"
          actionLabel="Create a habit"
        />
      ) : (
        <ul className="space-y-1">
          {visible.map((item) => {
            const done = isDoneToday(item, today);
            const busy = busyId === item.habit.id;

            return (
              <li key={item.habit.id}>
                <button
                  type="button"
                  onClick={() => void toggle(item)}
                  disabled={busy}
                  aria-pressed={done}
                  aria-label={
                    done
                      ? `Undo today's check-in for "${item.habit.title}"`
                      : `Check in to "${item.habit.title}" today`
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150",
                    "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                    busy && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors",
                      done
                        ? "border-accent bg-accent text-white"
                        : "border-border-strong bg-surface text-muted",
                    )}
                    aria-hidden="true"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px] font-medium",
                        done ? "text-muted line-through" : "text-fg",
                      )}
                    >
                      {item.habit.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted">
                      {item.currentStreak > 0 ? (
                        <>
                          <FlameIcon className="h-3 w-3 text-amber-500" />
                          {item.currentStreak} day
                          {item.currentStreak === 1 ? "" : "s"}
                        </>
                      ) : (
                        "No streak yet"
                      )}
                      <span aria-hidden="true">·</span>
                      {item.completedLast7}/{item.targetLast7} this week
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && todayStats.length > visible.length ? (
        <p className="mt-2 px-2 text-2xs text-muted">
          +{todayStats.length - visible.length} more scheduled today
        </p>
      ) : null}

      {!loading && visible.length > 0 ? (
        <a
          href="/habits"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-2xs font-medium text-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Manage habits
        </a>
      ) : null}
    </Card>
  );
}
