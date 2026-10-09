import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

// Server-side helpers for reading the signed-in user and their profile.
// Kept here so pages do not repeat the same query and null-handling.

/**
 * Returns the signed-in user, or null.
 * Uses getUser() rather than getSession(): getUser() verifies the token with
 * the Supabase Auth server, so the result is safe to trust for authorization.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the current user's profile row, or null if signed out.
 * Returns null (rather than throwing) when the row is missing, so a broken or
 * not-yet-backfilled profile never crashes a page.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, university, department, semester, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[DayForge] failed to load profile:", error.message);
    return null;
  }

  return data as Profile | null;
}
