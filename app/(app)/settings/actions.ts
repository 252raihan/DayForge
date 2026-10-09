"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProfileUpdate } from "@/types";

// Result shape the form uses to show errors. Server actions can't throw in a
// way the client can read, so we return a plain object instead.
export type UpdateProfileResult = {
  ok: boolean;
  message: string;
  /** Per-field errors, keyed by field name. */
  fieldErrors?: Partial<Record<keyof ProfileUpdate, string>>;
};

// Saves the user's profile.
//
// Runs on the server, so the row is updated with the signed-in user's own
// session - RLS then guarantees only their own row can change. We still pass an
// explicit id filter as a second line of defence.
export async function updateProfile(
  values: ProfileUpdate,
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

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }

  const { error } = await supabase
    .from("profiles")
    .update(trimmed)
    .eq("id", user.id);

  if (error) {
    console.error("[DayForge] profile update failed:", error.message);
    return { ok: false, message: "Could not save your profile. Please try again." };
  }

  // The top bar reads the name from the server, so refresh the shell to show it.
  revalidatePath("/", "layout");

  return { ok: true, message: "Profile saved." };
}
