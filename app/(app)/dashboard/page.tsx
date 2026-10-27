import { getProfile, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/types";
import DashboardTasks from "@/components/dashboard/DashboardTasks";
import { DashboardWelcome } from "@/components/dashboard/DashboardWelcome";

// Dashboard: the overview of "your day".
//
// Rendering split: the greeting and the date card are static for the whole
// session, so they render on the server. The task summary, progress and
// challenge panels are interactive (Yes/No buttons, checkboxes, check-ins), so
// the first page of tasks is fetched on the server and handed to a client
// component, which reuses the same `useTasks` data layer as the Tasks page.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [user, profile, tasks] = await Promise.all([getUser(), getProfile(), loadTasks()]);

  // "Raihan Ahmed" -> "Raihan"; falls back to the email's local part.
  const displayName =
    profile?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";

  return (
    <>
      <DashboardWelcome name={displayName} />
      {/* Seed data for the client hook. It refetches on mount, which is what
          keeps the list live when a task is added or ticked off. */}
      <DashboardTasks initialTasks={tasks} />
    </>
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
