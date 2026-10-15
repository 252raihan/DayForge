import type { TaskPriority, UserPreferences } from "@/types";

// The preference values both the server and the client need, with no Supabase
// import in sight.
//
// They live in their own module because lib/preferences.ts is a client module
// (it imports the browser Supabase client): a Server Component that imported it
// would pull `createBrowserClient` into the server bundle. Server and client
// therefore share this file instead.

/** The subset of `user_preferences` the UI actually reads. */
export type ResolvedPreferences = Pick<
  UserPreferences,
  "time_format" | "week_start" | "default_category" | "default_priority" | "show_completed_tasks"
>;

/** What a fresh account gets - the same values the database column defaults use. */
export const DEFAULT_PREFERENCES: ResolvedPreferences = {
  time_format: "24h",
  week_start: 1,
  default_category: null,
  default_priority: "medium",
  show_completed_tasks: true,
};

/** The preference columns as they arrive from the database (possibly null). */
export type PreferenceRow = {
  time_format?: string | null;
  week_start?: number | null;
  default_category?: string | null;
  default_priority?: string | null;
  show_completed_tasks?: boolean | null;
};

/**
 * Normalises a row (or a missing row) into usable values.
 *
 * Every field falls back individually rather than rejecting the whole row, so a
 * single unexpected value cannot blank out the rest of the user's settings.
 */
export function resolvePreferences(row: PreferenceRow | null | undefined): ResolvedPreferences {
  if (!row) return DEFAULT_PREFERENCES;

  return {
    time_format: row.time_format === "12h" || row.time_format === "24h"
      ? row.time_format
      : DEFAULT_PREFERENCES.time_format,
    week_start: row.week_start === 0 || row.week_start === 1
      ? row.week_start
      : DEFAULT_PREFERENCES.week_start,
    default_category:
      typeof row.default_category === "string" && row.default_category.trim()
        ? row.default_category
        : null,
    default_priority: isPriority(row.default_priority)
      ? row.default_priority
      : DEFAULT_PREFERENCES.default_priority,
    show_completed_tasks:
      typeof row.show_completed_tasks === "boolean"
        ? row.show_completed_tasks
        : DEFAULT_PREFERENCES.show_completed_tasks,
  };
}

/** True for the three values `tasks.priority` accepts. */
export function isPriority(value: unknown): value is TaskPriority {
  return value === "low" || value === "medium" || value === "high";
}

/** Formats a time of day for display, honouring the user's time format. */
export function formatTime(date: Date, timeFormat: "12h" | "24h"): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
}
