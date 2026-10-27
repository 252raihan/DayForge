// Verifies the configured Supabase project with the real anon key, without
// printing the key. Distinguishes: valid project / wrong key / paused project.
// Usage: node scripts/diagnose-supabase.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env.local parser (no dependency).
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("URL host:", new URL(url).host);
console.log("anon key length:", anon.length, "(not printed)");

const supabase = createClient(url, anon, { auth: { persistSession: false } });

// 1) Auth health with the anon key: proves the key is accepted (or not).
const { error: authError } = await supabase.auth.getSession();
console.log("auth.getSession():", authError ? `ERROR ${authError.message}` : "ok");

// 2) REST probe with anon key: 200 = project live, 401/403 = key rejected,
//    PGRST205-style body = table missing (not a connectivity problem).
const resp = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});
console.log("rest /profiles status:", resp.status);
const body = await resp.text();
if (resp.status !== 200) {
  console.log("rest body:", body.slice(0, 300));
} else {
  console.log("rest body rows:", body === "[]" ? "0 (RLS: anon sees none — expected)" : body);
}

// 3) Classification
if (resp.status === 200) {
  console.log("\nRESULT: project is LIVE and the anon key is valid.");
} else if (resp.status === 401 || resp.status === 403) {
  console.log("\nRESULT: host is reachable but the anon key is REJECTED (401/403).");
} else {
  console.log("\nRESULT: unexpected status", resp.status);
}
