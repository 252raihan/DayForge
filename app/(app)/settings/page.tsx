import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import LogoutButton from "@/components/LogoutButton";
import SettingsForm from "@/components/settings/SettingsForm";
import { getUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePreferences } from "@/lib/preferences-shared";
import type { UserPreferences } from "@/types";

// Settings - profile, appearance and task defaults. Server component: it loads
// the current values from Supabase and hands them to the form as initial state,
// so the controls always start from what is actually stored.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [profile, preferences] = await Promise.all([getProfile(), loadPreferences()]);

  // The theme preference lives on `profiles` (which the shell already loads).
  const theme = profile?.theme ?? "system";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, how DayForge looks, and the defaults applied to new tasks."
      />

      <div className="space-y-5">
        <section className="max-w-3xl rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold">Profile</h2>
          <p className="mb-5 mt-1 text-sm text-muted">
            These details are shown across DayForge.
          </p>

          {/* If the trigger or backfill has not created the row yet, saving
              will create it - so this is a note, not a blocker. */}
          {!profile ? (
            <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              We couldn&apos;t load your profile row. Saving below will create it. If this
              persists, run the SQL in <code>supabase/schema.sql</code> in the Supabase SQL
              Editor.
            </p>
          ) : null}

          <SettingsForm
            email={user.email ?? null}
            initialProfile={{
              name: profile?.name ?? "",
              university: profile?.university ?? "",
              department: profile?.department ?? "",
              semester: profile?.semester ?? "",
            }}
            initialPreferences={{
              theme,
              week_start: preferences.week_start,
              default_task_category: preferences.default_category,
              default_task_priority: preferences.default_priority,
              show_completed_tasks: preferences.show_completed_tasks,
              time_format: preferences.time_format,
            }}
          />
        </section>

        <section className="max-w-3xl rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold">Account</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Signed in as {user.email ?? "your account"}. Your email is your login and
            cannot be changed here.
          </p>

          <div className="rounded-xl border border-border bg-app p-4">
            <p className="text-sm font-medium">Sign out</p>
            <p className="mb-3 mt-1 text-xs text-muted">
              Ends this session on this device. Your tasks, notes, habits and challenges stay
              saved to your account.
            </p>
            <LogoutButton />
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * Reads the preference row with the server client.
 *
 * A failure falls back to the same defaults the database columns use, so a
 * missing migration leaves the page usable rather than blank.
 */
async function loadPreferences() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[DayForge] failed to load preferences:", error.message);
    }
    return resolvePreferences(null);
  }

  return resolvePreferences(data as UserPreferences | null);
}
