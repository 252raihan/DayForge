// One-off diagnostic: probes WHY the daily-status upsert fails, using only the
// anon key from .env.local. Prints status codes / Postgres error codes only -
// never keys, never row data. Delete after use.
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
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

function describe(res, body) {
  const code = body?.code ?? "";
  const msg = (body?.message ?? "").slice(0, 160);
  const hint = (body?.hint ?? "").slice(0, 80);
  const detail = (body?.details ?? "").slice(0, 80);
  console.log(`  HTTP ${res.status} ${code} | ${msg}${hint ? ` | hint: ${hint}` : ""}${detail ? ` | details: ${detail}` : ""}`);
}

// Probe 1: insert into task_daily_logs as anon. If the ON CONFLICT target is
// broken (no unique index/constraint), Postgres fails at planning with 42P10
// BEFORE RLS is evaluated. If we instead get an RLS error (42501/403), the
// unique index exists and the schema is fine.
const fakeTask = "00000000-0000-0000-0000-000000000000";
try {
  const res = await fetch(`${url}/rest/v1/task_daily_logs?on_conflict=task_id,log_date`, {
    method: "POST",
    headers,
    body: JSON.stringify({ task_id: fakeTask, log_date: "2026-01-01", completed: true }),
  });
  const body = await res.json().catch(() => ({}));
  console.log("Probe 1 - upsert (on_conflict=task_id,log_date):");
  describe(res, Array.isArray(body) ? body[0] : body);
} catch (err) {
  console.log("Probe 1 network error:", err.message);
}

// Probe 2: plain insert without on_conflict, isolating RLS from the conflict target.
try {
  const res = await fetch(`${url}/rest/v1/task_daily_logs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ task_id: fakeTask, log_date: "2026-01-02", completed: true }),
  });
  const body = await res.json().catch(() => ({}));
  console.log("Probe 2 - plain insert (no on_conflict):");
  describe(res, Array.isArray(body) ? body[0] : body);
} catch (err) {
  console.log("Probe 2 network error:", err.message);
}

// Probe 3: is the OpenAPI even listing the table's columns (schema cache OK)?
try {
  const res = await fetch(`${url}/rest/v1/`, { headers });
  const spec = await res.json();
  const t = spec?.definitions?.task_daily_logs;
  console.log("Probe 3 - OpenAPI task_daily_logs present:", Boolean(t));
  if (t) {
    console.log("  columns:", Object.keys(t.properties ?? {}).join(", "));
    console.log("  primary key per spec:", JSON.stringify(t.primaryKeys ?? t["x-primary-key"] ?? "(not listed)"));
  }
} catch (err) {
  console.log("Probe 3 network error:", err.message);
}
