import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PREFERENCES, type ResolvedPreferences } from "@/lib/preferences-shared";
import type { UserPreferences } from "@/types";

// Reads the signed-in user's saved preferences from the browser.
//
// Used by the client-side pages (Calendar, Habits) that need the week start,
// time format or task defaults but are not server-rendered with them. RLS
// scopes the query to the signed-in user, so no id filter is needed.
//
// The public preference controls live on the Settings page; this module only
// reads, so a page cannot accidentally write a preference the user did not set.

const CACHE_TTL_MS = 30_000;
let cached: { at: number; value: ResolvedPreferences } | null = null;

/** Drops the memoised read, so the next call reflects a fresh Settings save. */
export function invalidatePreferencesCache() {
  cached = null;
}

/**
 * Returns the user's preferences, falling back to the same defaults the
 * database uses when the row does not exist yet or the read fails.
 *
 * A failure here is deliberately non-fatal: a missing preference should never
 * stop the Calendar or the Habits page from rendering.
 */
export async function getPreferencesFromBrowser(): Promise<ResolvedPreferences> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .maybeSingle();

  if (error) {
    // PGRST116 = no row, which is not an error worth showing: the defaults
    // below are exactly what a fresh account uses.
    if (error.code !== "PGRST116") {
      console.error("[DayForge] failed to load preferences:", error.message);
    }
    return DEFAULT_PREFERENCES;
  }

  const row = data as UserPreferences | null;
  const value: ResolvedPreferences = row
    ? {
      time_format: row.time_format,
      week_start: row.week_start,
      default_category: row.default_category,
      default_priority: row.default_priority,
      show_completed_tasks: row.show_completed_tasks,
    }
    : DEFAULT_PREFERENCES;

  cached = { at: Date.now(), value };
  return value;
}

/** React binding for `getPreferencesFromBrowser`, with a loading flag. */
export function useResolvedPreferences() {
  const [preferences, setPreferences] = useState<ResolvedPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const value = await getPreferencesFromBrowser();
      if (cancelled) return;
      setPreferences(value);
      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { preferences, loading };
}
