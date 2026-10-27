// Reads the Supabase auth settings endpoint (public, anon key required) to see
// whether email confirmation is enabled for this project.
import { readFileSync } from "node:fs";

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

const resp = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: anon },
});
const settings = await resp.json();
console.log("status:", resp.status);
console.log("external_email_enabled:", settings.external?.email ?? settings.email_enabled ?? "n/a");
console.log("mailer_autoexpoom:", settings.mailer_autoconfirm ?? "n/a");
console.log("disable_signup:", settings.disable_signup ?? "n/a");
console.log("external_google_enabled:", settings.external?.google ?? "n/a");
console.log("full keys:", Object.keys(settings).join(", "));
