import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import LogoutButton from "@/components/LogoutButton";
import SettingsForm from "@/components/settings/SettingsForm";
import { Alert, Badge, Card, CardHeader } from "@/components/ui";
import { SettingsIcon, UserIcon, LogOutIcon } from "@/components/icons";
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

  const displayName = profile?.name?.trim() || user.email?.split("@")[0] || "Your account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, how DayForge looks, and the defaults applied to new tasks."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-4">
          <Card>
            {/* Identity header: avatar, name, and the one-line account summary. */}
            <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight text-fg">
                  {displayName}
                </p>
                <p className="truncate text-xs text-muted">{user.email ?? "No email on file"}</p>
              </div>
              <Badge tone="neutral" className="ml-auto hidden shrink-0 sm:inline-flex">
                Signed in
              </Badge>
            </div>

            <CardHeader
              title="Profile"
              icon={<UserIcon className="h-4 w-4" />}
              description="These details are shown across DayForge."
            />

            {/* If the trigger or backfill has not created the row yet, saving
                will create it - so this is a note, not a blocker. */}
            {!profile ? (
              <Alert tone="warning" className="mb-5">
                We couldn&apos;t load your profile row. Saving below will create it. If this
                persists, run the SQL in <code>supabase/schema.sql</code> in the Supabase SQL
                Editor.
              </Alert>
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
          </Card>
        </div>

        {/* Side column: a short "what saves where" note, then the account card. */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <Card className="bg-surface-2/50">
            <CardHeader
              title="About these settings"
              icon={<SettingsIcon className="h-4 w-4" />}
            />
            <ul className="space-y-2.5 text-2xs leading-relaxed text-muted">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span>
                  <span className="font-medium text-fg">Theme</span> applies immediately and is
                  saved to your account, so it follows you to a new device.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span>
                  <span className="font-medium text-fg">Week start</span> changes the Calendar
                  week view and the Habits week progress.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <span>
                  <span className="font-medium text-fg">Task defaults</span> pre-fill new tasks;
                  nothing already created changes.
                </span>
              </li>
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Account"
              icon={<LogOutIcon className="h-4 w-4" />}
              description={`Signed in as ${user.email ?? "your account"}.`}
            />

            <p className="mb-3 text-2xs leading-relaxed text-muted">
              Your email is your login and cannot be changed here. Signing out ends this
              session on this device only — your tasks, notes, habits and challenges stay
              saved to your account.
            </p>

            <LogoutButton />
          </Card>
        </div>
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
