import { todayKey } from "@/hooks/useTasks";
import type {
  Challenge,
  ChallengeCheckin,
  ChallengeProgress,
  ChallengeStatus,
  HabitLog,
  Task,
  TaskDailyLog,
} from "@/types";

// Challenge progress, as pure functions.
//
// Everything here is derived from persisted rows that were passed in - there is
// no estimation, no interpolation and no placeholder data. Keeping it pure (no
// Supabase import beyond the shared date helper) means the rules can be tested
// directly, which is why tests/challenges.test.mjs can assert them.

/** The records a challenge's progress may be measured from. */
export type ChallengeSources = {
  /** Daily task logs: which task was completed on which day. */
  taskLogs: TaskDailyLog[];
  /** Habit check-ins: which habit was done on which day. */
  habitLogs: HabitLog[];
  /** This challenge's own check-ins. */
  checkins: ChallengeCheckin[];
  /** Unfinished tasks, used as the denominator for task_completion goals. */
  eligibleTasks: Task[];
};

/**
 * Adds whole days to a YYYY-MM-DD key using UTC arithmetic.
 *
 * UTC is deliberate: the key is a calendar day with no time attached, so the
 * arithmetic must not be able to drag it onto a neighbouring day via a local
 * DST boundary.
 */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. Negative when `to` is past. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Inclusive list of day keys from `start` to `end`.
 * Returns [] when the range is inverted, rather than looping forever.
 */
export function dayKeysBetween(start: string, end: string): string[] {
  const total = daysBetween(start, end);
  if (total < 0) return [];
  const keys: string[] = [];
  for (let offset = 0; offset <= total; offset += 1) {
    keys.push(addDaysToKey(start, offset));
  }
  return keys;
}

/**
 * Where a challenge stands.
 *
 * "Completed" means the goal was actually reached, not merely that time has
 * passed. A challenge whose window has closed without reaching its goal is
 * "expired", which is a different message to the user.
 */
export function challengeStatus(
  challenge: Challenge,
  current: number,
  target: number | null,
  today: string = todayKey(),
): ChallengeStatus {
  if (target !== null && current >= target) return "completed";
  if (daysBetween(today, challenge.start_date) > 0) return "not_started";
  if (challenge.target_date && daysBetween(today, challenge.target_date) < 0) {
    return "expired";
  }
  return "active";
}

/** Progress percentage, or null when there is no numeric goal to divide by. */
export function challengePercent(current: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

/**
 * Counts the measured value for one challenge.
 *
 * Every branch counts rows that exist. Nothing is extrapolated: a
 * task_completion challenge with no daily logs reports 0, not "looks about
 * right".
 */
export function measureChallenge(
  challenge: Challenge,
  sources: ChallengeSources,
  today: string = todayKey(),
): number {
  // The window is the challenge's own dates. An open-ended challenge runs up to
  // today; a start date in the future yields an empty window, hence 0.
  const end = challenge.target_date ?? today;
  const window = new Set(dayKeysBetween(challenge.start_date, end));

  switch (challenge.goal_type) {
    case "checkin_count":
      return sources.checkins.filter((checkin) => window.has(checkin.log_date)).length;

    case "task_completion": {
      // Which tasks count: the ones that existed (were due) by the end of the
      // window and are still open. Completed tasks are excluded from the
      // denominator because the daily log already counts their completion.
      const taskIds = new Set(
        sources.eligibleTasks
          .filter((task) => !task.due_at || todayKey(new Date(task.due_at)) <= end)
          .map((task) => task.id),
      );
      return sources.taskLogs.filter(
        (log) => log.completed && window.has(log.log_date) && taskIds.has(log.task_id),
      ).length;
    }

    case "habit_completion":
      return sources.habitLogs.filter(
        (log) => log.done && window.has(log.log_date),
      ).length;

    case "manual":
    default:
      // Nothing is measured. The card says so rather than showing a number that
      // was never earned.
      return 0;
  }
}

/** The longest run of consecutive days containing at least one check-in. */
export function longestDailyStreak(dates: string[]): number {
  const unique = Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of unique) {
    run = previous !== null && daysBetween(previous, date) === 1 ? run + 1 : 1;
    previous = date;
    if (run > best) best = run;
  }

  return best;
}

/** Builds the whole picture for one challenge. */
export function buildChallengeProgress(
  challenge: Challenge,
  sources: ChallengeSources,
  today: string = todayKey(),
): ChallengeProgress {
  const current = measureChallenge(challenge, sources, today);
  const target = challenge.goal_target;
  const status = challengeStatus(challenge, current, target, today);

  return {
    challenge,
    status,
    current,
    target,
    percent: challengePercent(current, target),
    daysRemaining: challenge.target_date
      ? daysBetween(today, challenge.target_date)
      : null,
    checkedInToday: sources.checkins.some((checkin) => checkin.log_date === today),
  };
}
