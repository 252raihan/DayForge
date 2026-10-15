// One-off diagnostic: verifies the live schema shape that the failing flows
// depend on, using only the anon key. Never prints keys or row data.
//
// Method: a select naming a column that does not exist is rejected by PostgREST
// with PGRST204 naming the bad column, while a select naming only columns that
// DO exist succeeds. That lets each column be confirmed one by one without any
// authenticated session and without reading any rows (limit=0).
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch { }
  return { ...env, ...process.env };
}

const env = loadEnv(".env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function columnExists(table, column) {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=${column}&limit=1`,
    { headers },
  );
  if (res.ok) return "yes";
  const body = await res.json().catch(() => ({}));
  // PGRST204 names the offending column; anything else (RLS on empty result is
  // 200, so an error here is genuinely structural) is reported verbatim.
  return `NO (${body.code ?? res.status}: ${(body.message ?? "").slice(0, 120)})`;
}

const TASK_COLUMNS = [
  "id", "user_id", "title", "description", "due_at", "priority", "category",
  "status", "recurrence_type", "recurrence_days", "recurrence_source_id",
  "created_at",
];

const LOG_COLUMNS = [
  "id", "user_id", "task_id", "log_date", "completed", "created_at", "updated_at",
];

console.log("== public.tasks columns ==");
for (const col of TASK_COLUMNS) console.log(`  ${col.padEnd(24)} ${await columnExists("tasks", col)}`);

console.log("== public.task_daily_logs columns ==");
for (const col of LOG_COLUMNS) console.log(`  ${col.padEnd(24)} ${await columnExists("task_daily_logs", col)}`);

// The upsert's conflict target: a POST that violates RLS (42501) proves the
// ON CONFLICT target was INFERRED successfully at plan time (a bad target fails
// earlier with 42P10). Anon is always rejected by RLS, so nothing is written.
try {
  const res = await fetch(`${url}/rest/v1/task_daily_logs?on_conflict=task_id,log_date`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ task_id: "00000000-0000-0000-0000-000000000000", log_date: "2026-01-01", completed: true }),
  });
  const body = await res.json().catch(() => ({}));
  const code = body?.code ?? res.status;
  console.log("== upsert conflict target check ==");
  console.log(
    code === "42501"
      ? "  OK: conflict target (task_id, log_date) inferred; write stopped by RLS as expected for anon."
      : `  code ${code}: ${(body?.message ?? "").slice(0, 140)}`,
  );
} catch (err) {
  console.log("  network error:", err.message);
}
