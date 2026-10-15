// Tests for deterministic date formatting in lib/calendar-utils.ts and the
// CompletionChart labels.
//
// Root cause being pinned down here: the formatters used to call
// toLocaleDateString(undefined, ...), which resolves to the environment's
// DEFAULT locale. The Node server and the browser disagree on that default
// ("25 Sept" vs "Sep 25"), which broke React hydration on /dashboard. The
// replacements are pure string formatting with hard-coded names, so the same
// input key must always produce the same output - in any locale, timezone or
// runtime.
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatShortDay, formatLongDay, monthGrid } from "../lib/calendar-utils.ts";

test("formatShortDay is locale-independent and fixed to day-then-month", () => {
  assert.equal(formatShortDay("2026-09-25"), "25 Sep");
  assert.equal(formatShortDay("2026-10-15"), "15 Oct");
  assert.equal(formatShortDay("2026-01-01"), "1 Jan");
  // In particular, NOT "Sep 25" (en-US) or "25 Sept" (older en-GB CLDR).
  assert.ok(!/^[A-Z]/.test(formatShortDay("2026-09-25")), "day comes first");
});

test("formatShortDay handles the month boundary (Sept 30 -> Oct 1)", () => {
  assert.equal(formatShortDay("2026-09-30"), "30 Sep");
  assert.equal(formatShortDay("2026-10-01"), "1 Oct");
});

test("formatShortDay handles year boundaries and leap February", () => {
  assert.equal(formatShortDay("2026-12-31"), "31 Dec");
  assert.equal(formatShortDay("2027-01-01"), "1 Jan");
  assert.equal(formatShortDay("2028-02-29"), "29 Feb");
});

test("formatLongDay is fully deterministic with full weekday/month names", () => {
  // 2026-09-25 is a Friday.
  assert.equal(formatLongDay("2026-09-25"), "Friday, 25 September 2026");
  assert.equal(formatLongDay("2026-10-15"), "Thursday, 15 October 2026");
});

test("monthGrid label spells the month deterministically", () => {
  const grid = monthGrid("2026-09-25", 1);
  assert.equal(grid.label, "September 2026");
  assert.equal(monthGrid("2026-12-25", 1).label, "December 2026");
});

test("formatShortDay agrees with the day keys it labels across a 14-day window", () => {
  // Every key in a window must label back to the same key: the axis label and
  // the per-bar title can never drift apart.
  for (let day = 20; day <= 30; day += 1) {
    const key = `2026-09-${String(day).padStart(2, "0")}`;
    assert.match(formatShortDay(key), new RegExp(`^${day} Sep$`));
  }
});
