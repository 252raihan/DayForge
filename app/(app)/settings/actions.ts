"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DisplayPreferences, ProfileUpdate, UserPreferences } from "@/types";

// Result shape the form uses to show errors. Server actions can't throw in a
// way the client can read, so we return a plain object instead.
export type UpdateProfileResult = {
  ok: boolean;
  message: string;
  /** Per-field errors, keyed by field name. */
  fieldErrors?: Record<string, string>;
};

/**
 * Saves the profile AND the preferences, which live in two tables.
 *
 * Profile data goes to `profiles`; the appearance and task-display preferences
 * are written to both `profiles` (which the app shell already loads) and
 * `user_preferences` (the canonical preference row). Both writes are reported:
 * a half-applied save says so instead of claiming success.
 */
export async function updateSettings(input: {
  profile: ProfileUpdate;
  preferences: DisplayPreferences;
}): Promise<UpdateProfileResult> {
  const profileResult = await saveProfile(input.profile, input.preferences);
  if (!profileResult.ok) return profileResult;

  const preferencesResult = await savePreferences(input.preferences);
  if (!preferencesResult.ok) {
    return {
      ok: false,
      message:
        "Your profile was saved, but the display preferences could not be. Please try again.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

/** Saves just the time format, which lives only on `user_preferences`. */
export async function updateTimeFormat(
  timeFormat: UserPreferences["time_format"],
): Promise<UpdateProfileResult> {
  if (timeFormat !== "12h" && timeFormat !== "24h") {
    return { ok: false, message: "Choose a 12-hour or 24-hour clock." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, time_format: timeFormat }, { onConflict: "user_id" });

  if (error) {
    console.error("[DayForge] time format update failed:", error.message);
    return { ok: false, message: "Could not save the time format. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Time format saved." };
}

/** Writes `user_preferences` (upsert, so a missing row is created). */
async function savePreferences(
  preferences: DisplayPreferences,
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      week_start: preferences.week_start,
      default_category: preferences.default_task_category,
      default_priority: preferences.default_task_priority,
      show_completed_tasks: preferences.show_completed_tasks,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[DayForge] preferences update failed:", error.message);
    return { ok: false, message: "Could not save the display preferences." };
  }

  return { ok: true, message: "Preferences saved." };
}

// Saves the user's profile.
//
// Runs on the server, so the row is updated with the signed-in user's own
// session - RLS then guarantees only their own row can change. We still pass an
// explicit id filter as a second line of defence.
async function saveProfile(
  values: ProfileUpdate,
  preferences: DisplayPreferences,
): Promise<UpdateProfileResult> {
  const supabase = await createClient();

  // Never trust the client for identity: get the user from the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Your session has expired. Please log in again." };
  }

  // Trim, and treat empty strings as "not set" so the DB stores NULL, not "".
  const trimmed: ProfileUpdate = {
    name: values.name?.trim() || null,
    university: values.university?.trim() || null,
    department: values.department?.trim() || null,
    semester: values.semester?.trim() || null,
  };

  // Server-side validation. The form validates too, but a client check can be
  // bypassed, so this is the one that counts.
  const fieldErrors: UpdateProfileResult["fieldErrors"] = {};
  if (trimmed.name && trimmed.name.length > 80) {
    fieldErrors.name = "That name is too long (80 characters max).";
  }
  if (trimmed.university && trimmed.university.length > 120) {
    fieldErrors.university = "That's too long (120 characters max).";
  }
  if (trimmed.department && trimmed.department.length > 120) {
    fieldErrors.department = "That's too long (120 characters max).";
  }
  if (trimmed.semester && trimmed.semester.length > 40) {
    fieldErrors.semester = "That's too long (40 characters max).";
  }

  // Preference validation. A client-side check can be bypassed, so it happens
  // here too, before anything is written.
  if (preferences.theme !== "light" && preferences.theme !== "dark" && preferences.theme !== "system") {
    fieldErrors.theme = "Choose light, dark or system.";
  }
  if (preferences.week_start !== 0 && preferences.week_start !== 1) {
    fieldErrors.week_start = "Week start must be Sunday or Monday.";
  }
  const defaultCategory = preferences.default_task_category?.trim() || null;
  if (defaultCategory && defaultCategory.length > 60) {
    fieldErrors.default_task_category = "That's too long (60 characters max).";
  }
  const defaultPriority = preferences.default_task_priority;
  if (
    defaultPriority !== null &&
    defaultPriority !== "low" &&
    defaultPriority !== "medium" &&
    defaultPriority !== "high"
  ) {
    fieldErrors.default_task_priority = "Choose low, medium or high.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }

  const payload = {
    ...trimmed,
    theme: preferences.theme,
    week_start: preferences.week_start,
    default_task_category: defaultCategory,
    default_task_priority: defaultPriority,
    show_completed_tasks: preferences.show_completed_tasks,
  };

  // `.select()` so "no row matched" is distinguishable from success: without
  // it an RLS-filtered update reports ok while changing nothing.
  const { data: rows, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select("id");

  if (error) {
    console.error("[DayForge] settings update failed:", error.message);
    return { ok: false, message: "Could not save your settings. Please try again." };
  }

  if (!rows || rows.length === 0) {
    // No profile row exists for this account (the signup trigger never ran), so
    // create it rather than reporting a failure the user cannot act on.
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, ...payload });

    if (insertError) {
      console.error("[DayForge] settings insert failed:", insertError.message);
      return { ok: false, message: "Could not save your settings. Please try again." };
    }
  }

  return { ok: true, message: "Settings saved." };
}
