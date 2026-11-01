import { getProfile, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePreferences } from "@/lib/preferences-shared";
import type { Task, UserPreferences } from "@/types";
import DashboardTasks from "@/components/dashboard/DashboardTasks";
import { DashboardWelcome } from "@/components/dashboard/DashboardWelcome";

// Dashboard: the overview of "your day".
//
// Rendering split: the greeting is server-rendered (it depends on the request
// time and the profile), and the first page of tasks is fetched here so the
// first paint has real numbers. Everything interactive - the Yes/No buttons,
// the quick-add composer, the habit check-ins - lives in client components that
// reuse the same hooks as their full pages.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [user, profile, tasks, preferences] = await Promise.all([
    getUser(),
    getProfile(),
    loadTasks(),
    loadPreferences(),
  ]);

  // "Raihan Ahmed" -> "Raihan"; falls back to the email's local part.
  const displayName =
    profile?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";

  // Today's seeded numbers, computed from the same predicate the client hook
  // uses, so the greeting and the panels agree on the very first paint.
  const todayTasks = tasks.filter(isDueToday);
  const answered = todayTasks.filter((task) => task.status === "done").length;

  return (
    <>
      <DashboardWelcome
        name={displayName}
        percent={todayTasks.length === 0 ? null : Math.round((answered / todayTasks.length) * 100)}
        answered={answered}
        total={todayTasks.length}
      />
      <DashboardTasks initialTasks={tasks} weekStart={preferences.week_start} />
    </>
  );
}

/** A task whose due date falls on today, in local time. */
function isDueToday(task: Task): boolean {
  if (!task.due_at) return false;
  const due = new Date(task.due_at);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

/** The tasks the dashboard summarises: everything, earliest deadline first. */
async function loadTasks(): Promise<Task[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    // The client component does its own query and surfaces failures with an
    // error banner, so an empty list here still leaves the page usable.
    console.error("[DayForge] failed to load dashboard tasks:", error.message);
    return [];
  }

  return (data as Task[]) ?? [];
}

/**
 * The saved display preferences. A failure falls back to the same defaults the
 * database columns use, so the dashboard stays usable without a preference row.
 */
async function loadPreferences() {
  const supabase = await createClient();

  const { data, error } = await supabase.from("user_preferences").select("*").maybeSingle();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[DayForge] failed to load preferences:", error.message);
    }
    return resolvePreferences(null);
  }

  return resolvePreferences(data as UserPreferences | null);
}
