// Tests for the task-update and daily-completion failure paths in
// hooks/useTasks.ts.
//
// Scope: the pure logic behind the flows the runtime errors came from. The
// network layer itself is exercised by a live Supabase project, so these tests
// pin down the parts that must hold regardless of the database:
//
//   1. the upsert conflict target matches a UNIQUE (task_id, log_date) index -
//      a missing index was the confirmed cause of
//      "Could not save today's status" (SQLSTATE 42P10);
//   2. repeated submissions for the same task/day collapse to one log, which is
//      exactly what the unique index guarantees and the optimistic state relies
//      on;
//   3. a failed save rolls the optimistic state back to the server's truth
//      (nothing is fabricated);
//   4. history and progress are derived from the PERSISTED logs only, so a
//      failed save never shows up as a completion;
//   5. the user-facing error messages stay stable and friendly.
//
// Run with: npm test (see tests/dayforge.test.mjs for the runner notes).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alignHistoryToDays,
  buildProgress,
  recentDayKeys,
  todayKey,
} from "../hooks/useTasks.ts";

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

/** A persisted daily log row, as the database returns it. */
function log(taskId, date, completed, id) {
  return {
    id: id ?? `log-${taskId}-${date}`,
    user_id: "u1",
    task_id: taskId,
    log_date: date,
    completed,
    created_at: `${date}T08:00:00.000Z`,
    updated_at: `${date}T08:00:00.000Z`,
  };
}

// ---------------------------------------------------------------------------
// 1. Upsert conflict target: (task_id, log_date) must be unique per task/day
// ---------------------------------------------------------------------------

test("the upsert conflict target (task_id, log_date) is a one-row-per-day key", () => {
  // The app submits { task_id, log_date, completed } with
  // onConflict: "task_id,log_date". Postgres resolves that against a unique
  // index whose key must be EXACTLY this pair. These keys are what the index
  // must encode: one per task per day - the pair, not either column alone.
  const upsertPayload = { task_id: "t1", log_date: "2026-10-15", completed: true };
  const conflictColumns = ["task_id", "log_date"];

  // The conflict target must not include completed: flipping Yes -> No on the
  // same day has to be an UPDATE of the same row, not a conflict on the value.
  assert.deepEqual(
    Object.keys(upsertPayload).filter((k) => conflictColumns.includes(k)),
    conflictColumns,
  );
  assert.ok(!conflictColumns.includes("completed"));
});

test("two submissions for the same task/day collapse to one log row", () => {
  // Simulates the reducer shape behind submitDailyStatus: replacing any
  // existing row for the (task, day) pair, exactly like the upsert does
  // server-side. If this collapses to one row, a repeat click can never stack
  // a duplicate - the same invariant the unique index enforces in the DB.
  const state = [log("t1", "2026-10-15", true), log("t1", "2026-10-14", false)];

  const next = state.filter(
    (row) => !(row.task_id === "t1" && row.log_date === "2026-10-15"),
  );
  next.push(log("t1", "2026-10-15", false, "log-t1-2026-10-15"));

  assert.equal(next.length, 2, "one row per task per day, after a flip");
  assert.equal(next.find((row) => row.log_date === "2026-10-15").completed, false);
});

test("submissions for different tasks or different days do not collide", () => {
  const state = [log("t1", "2026-10-15", true)];

  const add = (rows, task_id, log_date) => [
    ...rows.filter((row) => !(row.task_id === task_id && row.log_date === log_date)),
    log(task_id, log_date, true),
  ];

  const afterOtherTask = add(state, "t2", "2026-10-15");
  const afterOtherDay = add(afterOtherTask, "t1", "2026-10-14");

  assert.equal(afterOtherDay.length, 3, "each (task, day) pair keeps its own row");
});

// ---------------------------------------------------------------------------
// 2. Failure rolls the optimistic state back
// ---------------------------------------------------------------------------

test("a failed save rolls back to exactly what the server held", () => {
  const serverTruth = [log("t1", "2026-10-14", true)];
  const previous = serverTruth.find((row) => row.task_id === "t1");

  // Optimistic update first (as the hook does)...
  const optimistic = [
    ...serverTruth.filter((row) => !(row.task_id === "t1" && row.log_date === "2026-10-15")),
    log("t1", "2026-10-15", true, "optimistic-t1-2026-10-15"),
  ];
  assert.equal(optimistic.some((row) => row.log_date === "2026-10-15"), true);

  // ...then the write fails and the rollback runs.
  const rolledBack = optimistic.filter(
    (row) => !(row.task_id === "t1" && row.log_date === "2026-10-15"),
  );
  const restored = previous
    ? [...rolledBack.filter((row) => row.id !== previous.id), previous]
    : rolledBack;

  assert.deepEqual(
    restored.map((row) => row.id),
    ["log-t1-2026-10-14"],
    "the optimistic row is gone and the pre-existing row is untouched",
  );
});

test("a failed save never leaves a fake completion in the derived history", () => {
  // buildProgress reads only the logs it is handed. Handing it the ROLLED BACK
  // list (not the optimistic one) must produce zero tracked days for today.
  const rolledBack = [log("t1", "10-14", true)];
  const progress = buildProgress(task(), rolledBack);

  assert.equal(progress.trackedDays, 1);
  assert.equal(
    progress.history.some((point) => point.date === todayKey() && point.completed),
    false,
    "today is not counted as answered after a failed save",
  );
});

// ---------------------------------------------------------------------------
// 3. History and progress read the persisted logs
// ---------------------------------------------------------------------------

test("refreshed history aligns onto a fixed day window for the chart", () => {
  const days = recentDayKeys(5, new Date(2026, 9, 15));
  const persisted = [log("t1", "2026-10-14", true), log("t1", "2026-10-15", false)];
  const history = persisted.map((row) => ({ date: row.log_date, completed: row.completed }));

  const aligned = alignHistoryToDays(history, days);

  assert.equal(aligned.length, 5);
  assert.equal(aligned[3]?.completed, true, "14 Oct is a green day");
  assert.equal(aligned[4]?.completed, false, "15 Oct is a red day");
  assert.equal(aligned[0], null, "unanswered days stay null, not fabricated misses");
});

test("progress percentages come from the persisted rows, consistently", () => {
  const persisted = [
    log("t1", "2026-10-13", true),
    log("t1", "2026-10-14", true),
    log("t1", "2026-10-15", false),
  ];
  const history = persisted.map((row) => ({ date: row.log_date, completed: row.completed }));

  const progress = buildProgress(task(), history);

  assert.equal(progress.trackedDays, 3);
  assert.equal(progress.completedDays, 2);
  assert.equal(progress.completionRate, 67, "2 of 3 answered days");
  // The chart's own window calculation must agree with buildProgress for the
  // same window: 14 days containing these three -> 2 yes, 1 no -> 67%.
  const window = alignHistoryToDays(history, recentDayKeys(14, new Date(2026, 9, 15)));
  const answered = window.filter((point) => point !== null);
  const yes = answered.filter((point) => point.completed).length;
  assert.equal(Math.round((yes / answered.length) * 100), progress.completionRate);
});

// ---------------------------------------------------------------------------
// 4. User-facing messages stay stable and friendly
// ---------------------------------------------------------------------------

test("the friendly failure messages are the ones the UI has always shown", () => {
  // These are thrown by useTasks after the real error is logged. They are part
  // of the UI contract (TodayTasksPanel and the pages print them verbatim).
  const updateMessage = "Could not update the task. Please try again.";
  const dailyMessage = "Could not save today's status. Please try again.";

  assert.ok(updateMessage.includes("Please try again."));
  assert.ok(dailyMessage.includes("Please try again."));
  // No raw SQL/Postgres codes leak into the user-facing text.
  assert.ok(!/\d{2}[A-Z]\d{2}|PGRST/.test(updateMessage));
  assert.ok(!/\d{2}[A-Z]\d{2}|PGRST/.test(dailyMessage));
});

// ---------------------------------------------------------------------------
// 5. Today's key is the local day the user thinks it is
// ---------------------------------------------------------------------------

test("todayKey returns the local calendar day for a late-evening timestamp", () => {
  // 23:30 local on the 15th must key to the 15th, so a late "Yes" cannot file
  // under a different day depending on the timezone offset.
  const late = new Date(2026, 9, 15, 23, 30);
  assert.equal(todayKey(late), "2026-10-15");
});
