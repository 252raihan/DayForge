// Tests for the pure logic behind the daily-completion feature, the calendar
// grid, habits and challenges.
//
// Runner: Node's built-in `node --test`, with Node's own type stripping (`--experimental-strip-types`).
// That is why there is no test framework in package.json: the rules under test
// are pure functions, so the platform can run them directly and the project
// gains no dependency.
//
// The source files are imported with an explicit .ts extension and their
// `@/...` imports are resolved by the `imports` map in package.json.
//
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alignHistoryToDays,
  buildProgress,
  isDueToday,
  isOverdue,
  isUpcoming,
  localInputToUtc,
  matchesFilter,
  nextOccurrence,
  recurrenceLabel,
  recentDayKeys,
  todayKey,
  utcToLocalInput,
} from "../hooks/useTasks.ts";
import { parseTags } from "../lib/note-utils.ts";
import { monthGrid, shiftDays, shiftMonth, taskDayKey, weekGrid } from "../lib/calendar-utils.ts";
import { buildHabitStats, currentStreak, isScheduledOn } from "../lib/habit-utils.ts";
import {
  buildChallengeProgress,
  challengePercent,
  challengeStatus,
  dayKeysBetween,
  longestDailyStreak,
  measureChallenge,
} from "../lib/challenge-utils.ts";
import { resolvePreferences } from "../lib/preferences-shared.ts";
import { isTaskEligibleToday, parseScope, tasksInScope } from "../lib/home-scope.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A Task with only the fields a test cares about. */
function task(overrides = {}) {
  return {
    id: "t1",
    user_id: "u1",
    title: "Task",
    description: null,
    due_at: null,
    priority: "medium",
    category: "Personal",
    status: "todo",
    created_at: "2026-10-01T08:00:00.000Z",
    recurrence_type: "none",
    recurrence_days: null,
    recurrence_source_id: null,
    ...overrides,
  };
}

/** A daily log row. */
function log(taskId, date, completed) {
  return {
    id: `log-${taskId}-${date}`,
    user_id: "u1",
    task_id: taskId,
    log_date: date,
    completed,
    created_at: "2026-10-01T08:00:00.000Z",
    updated_at: "2026-10-01T08:00:00.000Z",
  };
}

/** A habit row. */
function habit(overrides = {}) {
  return {
    id: "h1",
    user_id: "u1",
    title: "Read",
    description: null,
    frequency: "daily",
    habit_days: null,
    target_per_week: null,
    archived: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A habit log row. */
function habitLog(habitId, date) {
  return {
    id: `hl-${habitId}-${date}`,
    user_id: "u1",
    habit_id: habitId,
    log_date: date,
    done: true,
    created_at: `${date}T00:00:00.000Z`,
  };
}

/** A challenge row. */
function challenge(overrides = {}) {
  return {
    id: "c1",
    user_id: "u1",
    title: "Challenge",
    description: null,
    start_date: "2026-10-01",
    target_date: "2026-10-31",
    goal_type: "checkin_count",
    goal_target: 10,
    created_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A challenge check-in row. */
function checkin(challengeId, date) {
  return {
    id: `ci-${challengeId}-${date}`,
    user_id: "u1",
    challenge_id: challengeId,
    log_date: date,
    note: null,
    created_at: `${date}T00:00:00.000Z`,
  };
}

// ---------------------------------------------------------------------------
// Daily completion: the percentage rules
// ---------------------------------------------------------------------------

test("buildProgress counts answered days, not calendar days", () => {
  const logs = [
    log("t1", "2026-10-01", true),
    log("t1", "2026-10-02", false),
    log("t1", "2026-10-03", true),
  ];

  const progress = buildProgress(task(), logs);

  assert.equal(progress.trackedDays, 3, "three days were answered");
  assert.equal(progress.completedDays, 2);
  assert.equal(progress.completionRate, 67, "2 of 3 answered days were Yes");
  assert.deepEqual(progress.history[0], { date: "2026-10-01", completed: true });
});

test("buildProgress reports 0% rather than dividing by zero", () => {
  const progress = buildProgress(task(), []);

  assert.equal(progress.trackedDays, 0);
  assert.equal(progress.completedDays, 0);
  assert.equal(progress.completionRate, 0);
});

test("a day with no log is not a miss: it aligns as null", () => {
  const history = [
    { date: "2026-10-01", completed: true },
    { date: "2026-10-03", completed: false },
  ];
  const aligned = alignHistoryToDays(history, ["2026-10-01", "2026-10-02", "2026-10-03"]);

  assert.equal(aligned[0]?.completed, true);
  assert.equal(aligned[1], null, "the unanswered day stays null, not false");
  assert.equal(aligned[2]?.completed, false);
});

test("recentDayKeys returns a gap-free ascending window ending at the given day", () => {
  const keys = recentDayKeys(3, new Date(2026, 9, 15)); // 15 Oct 2026, local
  assert.deepEqual(keys, ["2026-10-13", "2026-10-14", "2026-10-15"]);
});

test("todayKey uses the local calendar day, not the UTC one", () => {
  // 23:30 local on the 15th is already the 16th in UTC for a +05:00 zone, so a
  // UTC-derived key would file the day's answers under tomorrow.
  const late = new Date(2026, 9, 15, 23, 30);
  assert.equal(todayKey(late), "2026-10-15");
});

// ---------------------------------------------------------------------------
// Daily completion: task eligibility and filters
// ---------------------------------------------------------------------------

test("eligibility is status-based, so a task completed today is not asked again", () => {
  assert.equal(isTaskEligibleToday(task({ status: "todo" })), true);
  assert.equal(isTaskEligibleToday(task({ status: "in_progress" })), true);
  assert.equal(isTaskEligibleToday(task({ status: "done" })), false);
});

test("a completed task is neither overdue nor upcoming", () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

  assert.equal(isOverdue(task({ due_at: yesterday, status: "todo" })), true);
  assert.equal(isOverdue(task({ due_at: yesterday, status: "done" })), false);
  assert.equal(isUpcoming(task({ due_at: tomorrow, status: "todo" })), true);
  assert.equal(isUpcoming(task({ due_at: tomorrow, status: "done" })), false);
});

test("the today tab excludes overdue rows so the counts do not double up", () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const overdue = task({ due_at: yesterday, status: "todo" });

  assert.equal(matchesFilter(overdue, "overdue"), true);
  assert.equal(matchesFilter(overdue, "today"), false);
});

test("isDueToday is a local-calendar-day comparison", () => {
  const now = new Date();
  const midday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  assert.equal(isDueToday(task({ due_at: midday.toISOString() })), true);
});

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

test("nextOccurrence steps a daily task forward by one day", () => {
  const base = new Date("2026-10-15T09:00:00.000Z");
  const next = nextOccurrence(task({ due_at: base.toISOString(), recurrence_type: "daily" }));

  assert.ok(next);
  assert.equal(new Date(next).getTime() - base.getTime(), 86_400_000);
});

test("nextOccurrence keeps the time of day for a weekly task", () => {
  const base = new Date("2026-10-15T09:00:00.000Z");
  const next = nextOccurrence(task({ due_at: base.toISOString(), recurrence_type: "weekly" }));

  assert.ok(next);
  assert.equal(new Date(next).toISOString().slice(11, 16), "09:00");
});

test("nextOccurrence walks to the next selected weekday for a custom task", () => {
  // 15 Oct 2026 is a Thursday (weekday 4). Asking only for Tuesdays (2) must
  // land on the following Tuesday, not on the next day.
  const base = new Date(2026, 9, 15, 9, 0, 0);
  const next = nextOccurrence(
    task({
      due_at: base.toISOString(),
      recurrence_type: "custom",
      recurrence_days: [2],
    }),
  );

  assert.ok(next);
  assert.equal(new Date(next).getDay(), 2, "the next occurrence is a Tuesday");
});

test("a task with no due date has no next occurrence to schedule", () => {
  assert.equal(nextOccurrence(task({ recurrence_type: "daily" })), null);
});

test("a custom recurrence with no days picked has no next occurrence", () => {
  const base = new Date("2026-10-15T09:00:00.000Z");
  assert.equal(
    nextOccurrence(
      task({
        due_at: base.toISOString(),
        recurrence_type: "custom",
        recurrence_days: [],
      }),
    ),
    null,
  );
});

test("recurrenceLabel names the days for a custom recurrence", () => {
  const label = recurrenceLabel(
    task({ recurrence_type: "custom", recurrence_days: [1, 3, 5] }),
  );
  assert.equal(label, "Repeats Mon, Wed, Fri");
});

// ---------------------------------------------------------------------------
// Dates crossing the input boundary
// ---------------------------------------------------------------------------

test("a local datetime input round-trips through UTC storage", () => {
  const local = "2026-10-15T14:30";
  const stored = localInputToUtc(local);

  assert.ok(stored);
  assert.equal(utcToLocalInput(stored), local, "the same wall-clock time comes back");
});

test("an empty due date is stored as null, not an invalid date", () => {
  assert.equal(localInputToUtc(""), null);
  assert.equal(utcToLocalInput(null), "");
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

test("only a category of 'course' is treated as the course scope", () => {
  assert.equal(parseScope("Course"), "course");
  assert.equal(parseScope("  course  "), "course");
  assert.equal(parseScope("Personal"), "home");
  assert.equal(parseScope("Assignment"), "home");
  assert.equal(parseScope(null), "home");
  assert.equal(parseScope(undefined), "home");
});

test("tasksInScope filters by category, not by title", () => {
  const tasks = [
    task({ id: "a", category: "Personal" }),
    task({ id: "b", category: "Course" }),
    task({ id: "c", category: "Assignment" }),
  ];

  assert.deepEqual(
    tasksInScope(tasks, "course").map((t) => t.id),
    ["b"],
  );
  assert.deepEqual(
    tasksInScope(tasks, "home").map((t) => t.id),
    ["a", "c"],
  );
});

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

test("parseTags trims, lowercases, strips '#' and de-duplicates", () => {
  assert.deepEqual(parseTags("Exam, #exam , revision"), ["exam", "revision"]);
  assert.deepEqual(parseTags("  ,  "), []);
  assert.deepEqual(parseTags("Physics,physics,PHYSICS"), ["physics"]);
});

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

test("a month grid always covers six weeks", () => {
  const grid = monthGrid("2026-10-15", 1);
  assert.equal(grid.days.length, 42);
});

test("a month grid starts on the configured week start", () => {
  const monday = monthGrid("2026-10-15", 1);
  const sunday = monthGrid("2026-10-15", 0);

  assert.equal(monday.weekdayLabels[0], "Mon");
  assert.equal(sunday.weekdayLabels[0], "Sun");
});

test("a month grid marks days outside the month", () => {
  const grid = monthGrid("2026-10-15", 1);
  const firstOfMonth = grid.days.find((day) => day.date === "2026-10-01");
  const lastOfMonth = grid.days.find((day) => day.date === "2026-10-31");

  assert.equal(firstOfMonth?.inMonth, true);
  assert.equal(lastOfMonth?.inMonth, true);
  assert.equal(grid.days.some((day) => !day.inMonth), true, "padding days exist");
});

test("stepping months clamps the day instead of overflowing", () => {
  // 31 January + 1 month must be the end of February, not 2 or 3 March.
  assert.equal(shiftMonth("2026-01-31", 1), "2026-02-28");
  assert.equal(shiftMonth("2026-03-31", -1), "2026-02-28");
  // A leap year keeps 29 February.
  assert.equal(shiftMonth("2024-01-31", 1), "2024-02-29");
});

test("shiftDays crosses month and year boundaries", () => {
  assert.equal(shiftDays("2026-10-31", 1), "2026-11-01");
  assert.equal(shiftDays("2026-01-01", -1), "2025-12-31");
});

test("a week grid is exactly the seven days containing the anchor", () => {
  const grid = weekGrid("2026-10-15", 1); // Thursday
  assert.equal(grid.days.length, 7);
  assert.equal(grid.days[0].date, "2026-10-12", "week starts Monday");
  assert.equal(grid.days[6].date, "2026-10-18");
});

test("a task with no due date floats onto today rather than disappearing", () => {
  assert.equal(taskDayKey(task({ due_at: null })), todayKey());
});

test("a task's day key is its local calendar day", () => {
  const local = new Date(2026, 9, 15, 14, 0, 0);
  assert.equal(taskDayKey(task({ due_at: local.toISOString() })), "2026-10-15");
});

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

test("a daily habit is scheduled every day", () => {
  const daily = habit({ frequency: "daily" });
  assert.equal(isScheduledOn(daily, "2026-10-15"), true);
  assert.equal(isScheduledOn(daily, "2026-10-18"), true);
});

test("a weekly habit is only scheduled on its chosen weekdays", () => {
  // 15 Oct 2026 is Thursday (4); 17 Oct is Saturday (6).
  const weekly = habit({ frequency: "weekly", habit_days: [1, 3] }); // Mon, Wed

  assert.equal(isScheduledOn(weekly, "2026-10-15"), false);
  assert.equal(isScheduledOn(weekly, "2026-10-19"), true); // Monday
});

test("a weekly habit with no days selected falls back to every day", () => {
  const broken = habit({ frequency: "weekly", habit_days: [] });
  assert.equal(isScheduledOn(broken, "2026-10-15"), true);
});

test("a streak is counted from date-specific records", () => {
  const daily = habit({ frequency: "daily" });
  const checked = new Set(["2026-10-15", "2026-10-14", "2026-10-13"]);

  assert.equal(currentStreak(daily, checked, "2026-10-15"), 3);
});

test("an unanswered today does not break a streak that is still running", () => {
  const daily = habit({ frequency: "daily" });
  // Today is not answered yet, but yesterday and the day before were.
  const checked = new Set(["2026-10-14", "2026-10-13"]);

  assert.equal(currentStreak(daily, checked, "2026-10-15"), 2);
});

test("a missed scheduled day does break the streak", () => {
  const daily = habit({ frequency: "daily" });
  // 14 Oct is a scheduled day with no check-in, so the run stops there.
  const checked = new Set(["2026-10-15", "2026-10-13"]);

  assert.equal(currentStreak(daily, checked, "2026-10-15"), 1);
});

test("days a habit is not scheduled for are skipped, not counted as misses", () => {
  // Mon/Wed/Fri habit: Thu 15 and Sun 18 are not scheduled, so a run of
  // Mondays/Wednesdays/Fridays is unbroken across them.
  const weekly = habit({ frequency: "weekly", habit_days: [1, 3, 5] });
  const checked = new Set(["2026-10-14", "2026-10-12", "2026-10-09"]);

  assert.equal(currentStreak(weekly, checked, "2026-10-14"), 3);
});

test("buildHabitStats reports real totals and a 14-day strip", () => {
  const daily = habit({ frequency: "daily" });
  const logs = [
    habitLog("h1", "2026-10-15"),
    habitLog("h1", "2026-10-14"),
    habitLog("h1", "2026-10-10"),
  ];

  const stats = buildHabitStats(daily, logs, 1, 14, "2026-10-15");

  assert.equal(stats.totalCompletions, 3);
  assert.equal(stats.currentStreak, 2, "15th and 14th are consecutive");
  assert.equal(stats.recent.length, 14);
  assert.equal(stats.recent[13]?.log_date, "2026-10-15", "the strip ends today");
  assert.equal(
    stats.recent.some((entry) => entry === null),
    true,
    "unchecked days are null, not fabricated rows",
  );
});

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

test("dayKeysBetween is inclusive and empty when inverted", () => {
  assert.deepEqual(dayKeysBetween("2026-10-01", "2026-10-03"), [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
  ]);
  assert.deepEqual(dayKeysBetween("2026-10-03", "2026-10-01"), []);
});

test("a checkin_count challenge counts only real check-ins inside its window", () => {
  const sources = {
    taskLogs: [],
    habitLogs: [],
    checkins: [
      checkin("c1", "2026-10-02"),
      checkin("c1", "2026-10-05"),
      checkin("c1", "2026-11-05"), // outside the challenge's window
    ],
    eligibleTasks: [],
  };

  assert.equal(measureChallenge(challenge(), sources, "2026-10-15"), 2);
});

test("a task_completion challenge counts completed daily logs in the window", () => {
  const sources = {
    taskLogs: [
      log("t1", "2026-10-02", true),
      log("t1", "2026-10-03", false), // answered No: not a completion
      log("t1", "2026-10-04", true),
      log("t1", "2026-11-01", true), // outside the window
    ],
    habitLogs: [],
    checkins: [],
    eligibleTasks: [task({ id: "t1" })],
  };

  assert.equal(measureChallenge(challenge({ goal_type: "task_completion" }), sources, "2026-10-15"), 2);
});

test("a habit_completion challenge counts habit check-ins in the window", () => {
  const sources = {
    taskLogs: [],
    habitLogs: [
      habitLog("h1", "2026-10-02"),
      habitLog("h1", "2026-10-09"),
      habitLog("h1", "2026-12-01"),
    ],
    checkins: [],
    eligibleTasks: [],
  };

  assert.equal(measureChallenge(challenge({ goal_type: "habit_completion" }), sources, "2026-10-15"), 2);
});

test("a manual challenge measures nothing rather than inventing progress", () => {
  const sources = {
    taskLogs: [log("t1", "2026-10-02", true)],
    habitLogs: [habitLog("h1", "2026-10-02")],
    checkins: [checkin("c1", "2026-10-02")],
    eligibleTasks: [task()],
  };

  assert.equal(measureChallenge(challenge({ goal_type: "manual" }), sources, "2026-10-15"), 0);
});

test("progress percentage needs a target and is capped at 100", () => {
  assert.equal(challengePercent(5, 10), 50);
  assert.equal(challengePercent(15, 10), 100, "overshooting does not exceed 100");
  assert.equal(challengePercent(5, null), null, "no target means no percentage");
  assert.equal(challengePercent(5, 0), null);
});

test("a challenge with no measurable goal reports null, not 0%", () => {
  const progress = buildChallengeProgress(
    challenge({ goal_type: "manual", goal_target: null }),
    { taskLogs: [], habitLogs: [], checkins: [], eligibleTasks: [] },
    "2026-10-15",
  );

  assert.equal(progress.percent, null);
  assert.equal(progress.target, null);
});

test("a challenge is completed only when the goal is actually reached", () => {
  const active = buildChallengeProgress(
    challenge({ goal_target: 10 }),
    { taskLogs: [], habitLogs: [], checkins: [checkin("c1", "2026-10-02")], eligibleTasks: [] },
    "2026-10-15",
  );
  assert.equal(active.status, "active");

  const checkins = Array.from({ length: 10 }, (_, index) =>
    checkin("c1", `2026-10-${String(index + 1).padStart(2, "0")}`),
  );
  const done = buildChallengeProgress(
    challenge({ goal_target: 10 }),
    { taskLogs: [], habitLogs: [], checkins, eligibleTasks: [] },
    "2026-10-15",
  );
  assert.equal(done.status, "completed");
  assert.equal(done.percent, 100);
});

test("a closed window that missed its goal is expired, not completed", () => {
  const expired = buildChallengeProgress(
    challenge({ goal_target: 100 }),
    { taskLogs: [], habitLogs: [], checkins: [checkin("c1", "2026-10-02")], eligibleTasks: [] },
    "2026-11-15",
  );

  assert.equal(expired.status, "expired");
  assert.equal(expired.daysRemaining, -15);
});

test("a challenge starting in the future has not started", () => {
  assert.equal(
    challengeStatus(challenge({ start_date: "2026-11-01" }), 0, 10, "2026-10-15"),
    "not_started",
  );
});

test("checkedInToday reflects a real row for today", () => {
  const progress = buildChallengeProgress(
    challenge(),
    {
      taskLogs: [],
      habitLogs: [],
      checkins: [checkin("c1", "2026-10-15")],
      eligibleTasks: [],
    },
    "2026-10-15",
  );

  assert.equal(progress.checkedInToday, true);
});

test("longestDailyStreak measures consecutive days, ignoring repeats", () => {
  assert.equal(
    longestDailyStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-02"]),
    3,
  );
  assert.equal(longestDailyStreak(["2026-10-01", "2026-10-05"]), 1);
  assert.equal(longestDailyStreak([]), 0);
});

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

test("missing preferences fall back to the database defaults", () => {
  const resolved = resolvePreferences(null);

  assert.equal(resolved.time_format, "24h");
  assert.equal(resolved.week_start, 1);
  assert.equal(resolved.default_priority, "medium");
  assert.equal(resolved.show_completed_tasks, true);
});

test("an unexpected value falls back on its own without blanking the rest", () => {
  const resolved = resolvePreferences({
    time_format: "nonsense",
    week_start: 3,
    default_category: "  ", // whitespace only counts as unset
    default_priority: "urgent",
    show_completed_tasks: false,
  });

  assert.equal(resolved.time_format, "24h", "invalid format falls back");
  assert.equal(resolved.week_start, 1, "invalid week start falls back");
  assert.equal(resolved.default_category, null, "blank category is null");
  assert.equal(resolved.default_priority, "medium", "invalid priority falls back");
  assert.equal(resolved.show_completed_tasks, false, "a valid value is kept");
});
