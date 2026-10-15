// Diagnostic: checks that every table DayForge uses is reachable through the
// Supabase REST API (PostgREST) of the project configured in .env.local.
//
// Prints ONLY the project host's ref and per-table HTTP status / error codes.
// It never prints keys, and because it uses the anon key without a user
// session, RLS returns zero rows - so no user data is ever read.
//
// Usage: node scripts/check-supabase.mjs
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // fall through to process.env
  }
  return { ...env, ...process.env };
}

const env = loadEnv(".env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
console.log(`Project ref: ${ref}`);

const TABLES = [
  "profiles",
  "tasks",
  "subtasks",
  "task_daily_logs",
  "notes",
  "habits",
  "habit_logs",
  "challenges",
  "challenge_checkins",
  "user_preferences",
];

for (const table of TABLES) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    let detail = "";
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      detail = ` ${body.code ?? ""} ${body.message ?? ""}`.trimEnd();
    }
    console.log(`${table.padEnd(20)} HTTP ${res.status}${detail}`);
  } catch (err) {
    console.log(`${table.padEnd(20)} network error: ${err.message}`);
  }
}
