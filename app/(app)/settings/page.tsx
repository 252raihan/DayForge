import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ProfileForm from "@/components/settings/ProfileForm";
import { getUser, getProfile } from "@/lib/auth";

// Settings - edit profile details. Server component: it loads the current
// values from Supabase and passes them to the form as initial state.
export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile details. These are shown across DayForge."
      />

      <section className="max-w-2xl rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 text-base font-semibold">Profile</h2>

        {/* If the trigger or backfill has not created the row yet, the form
            still works - the update below will fail, so warn instead. */}
        {!profile ? (
          <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            We couldn&apos;t load your profile row. If this is a fresh project,
            run the SQL in <code>supabase/schema.sql</code> via the Supabase SQL Editor.
          </p>
        ) : null}

        <ProfileForm
          email={user.email ?? null}
          initialValues={{
            name: profile?.name ?? "",
            university: profile?.university ?? "",
            department: profile?.department ?? "",
            semester: profile?.semester ?? "",
          }}
        />
      </section>
    </>
  );
}
