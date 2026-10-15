"use client";

import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/ui/Form";
import { updateSettings, updateTimeFormat } from "@/app/(app)/settings/actions";
import { invalidatePreferencesCache } from "@/lib/preferences";
import type {
  DisplayPreferences,
  ProfileUpdate,
  TaskPriority,
  ThemePreference,
} from "@/types";

// The Settings form: profile fields, appearance, and the task defaults.
//
// Two things here are more than a form:
//
//  1. The theme is applied to <html> immediately on selection, so the switch is
//     visible before anything is saved. Saving persists it per account (on
//     `profiles`), which is what makes it survive a new device.
//  2. The theme choice is mirrored into localStorage, which is the same key the
//     pre-paint script in app/layout.tsx reads - so the next page load paints in
//     the chosen theme with no flash.

export type SettingsFormProps = {
  email: string | null;
  initialProfile: ProfileUpdate;
  initialPreferences: DisplayPreferences & { time_format: "12h" | "24h" };
};

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const PRIORITIES: (TaskPriority | "")[] = ["", "low", "medium", "high"];

export default function SettingsForm({
  email,
  initialProfile,
  initialPreferences,
}: SettingsFormProps) {
  const [profile, setProfile] = useState<ProfileUpdate>(initialProfile);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function setProfileField(field: keyof ProfileUpdate, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    setMessage(null);
  }

  function setPreference<K extends keyof DisplayPreferences>(
    key: K,
    value: DisplayPreferences[K],
  ) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    setMessage(null);
  }

  /**
   * Applies a theme to the document straight away.
   *
   * "system" removes the stored preference so the pre-paint script falls back to
   * the OS setting on the next load.
   */
  function applyTheme(theme: ThemePreference) {
    setPreference("theme", theme);

    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);

    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";

    try {
      if (theme === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", theme);
    } catch {
      // localStorage can be unavailable (private mode); the class above still
      // applies for this session.
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    // Cheap client-side checks first, to avoid a pointless round-trip. The
    // server action validates again.
    const next: Record<string, string> = {};
    if ((profile.name?.length ?? 0) > 80) next.name = "That name is too long (80 characters max).";
    if ((profile.university?.length ?? 0) > 120) next.university = "That's too long (120 characters max).";
    if ((profile.department?.length ?? 0) > 120) next.department = "That's too long (120 characters max).";
    if ((profile.semester?.length ?? 0) > 40) next.semester = "That's too long (40 characters max).";
    if ((preferences.default_task_category?.length ?? 0) > 60) {
      next.default_task_category = "That's too long (60 characters max).";
    }

    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      setMessage({ tone: "error", text: "Please fix the highlighted fields." });
      return;
    }

    startTransition(async () => {
      const result = await updateSettings({
        profile,
        preferences: {
          theme: preferences.theme,
          week_start: preferences.week_start,
          default_task_category: preferences.default_task_category?.trim() || null,
          default_task_priority: preferences.default_task_priority,
          show_completed_tasks: preferences.show_completed_tasks,
        },
      });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage({ tone: "error", text: result.message });
        return;
      }

      // The cached preference read (used by the Calendar and Habits pages) now
      // describes the previous settings, so drop it.
      invalidatePreferencesCache();
      setMessage({ tone: "success", text: result.message });
    });
  }

  function handleTimeFormatChange(value: "12h" | "24h") {
    setPreferences((prev) => ({ ...prev, time_format: value }));

    startTransition(async () => {
      const result = await updateTimeFormat(value);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      invalidatePreferencesCache();
      setMessage({ tone: "success", text: result.message });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {/* Profile ------------------------------------------------------- */}
      <div className="space-y-5">
        <Field
          id="settings-name"
          label="Name"
          value={profile.name ?? ""}
          onChange={(v) => setProfileField("name", v)}
          error={fieldErrors.name}
          placeholder="Your full name"
          autoComplete="name"
        />

        {/* Email is managed by Supabase Auth, so it is read-only here. */}
        <div className="space-y-1.5">
          <label htmlFor="settings-email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            value={email ?? ""}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-border bg-app px-3.5 py-2.5 text-sm text-muted"
          />
          <p className="text-xs text-muted">
            Your email is your login and can&apos;t be changed here.
          </p>
        </div>

        <Field
          id="settings-university"
          label="University"
          value={profile.university ?? ""}
          onChange={(v) => setProfileField("university", v)}
          error={fieldErrors.university}
          placeholder="e.g. University of Dhaka"
          autoComplete="organization"
        />

        <Field
          id="settings-department"
          label="Department"
          value={profile.department ?? ""}
          onChange={(v) => setProfileField("department", v)}
          error={fieldErrors.department}
          placeholder="e.g. Computer Science & Engineering"
        />

        <Field
          id="settings-semester"
          label="Semester"
          value={profile.semester ?? ""}
          onChange={(v) => setProfileField("semester", v)}
          error={fieldErrors.semester}
          placeholder="e.g. 6th"
        />
      </div>

      {/* Appearance ---------------------------------------------------- */}
      <fieldset className="space-y-3 border-t border-border pt-6">
        <legend className="text-sm font-semibold">Appearance</legend>

        <div>
          <p className="mb-2 text-sm font-medium">Theme</p>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((option) => {
              const selected = preferences.theme === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-muted hover:bg-accent-soft/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={selected}
                    onChange={() => applyTheme(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            {fieldErrors.theme ? (
              <span className="font-medium text-red-600 dark:text-red-400">
                {fieldErrors.theme}
              </span>
            ) : (
              "Applied immediately. Choose System to follow your device setting, then save to keep it on every device."
            )}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-week-start" className="mb-1.5 block text-sm font-medium">
              Week starts on
            </label>
            <select
              id="settings-week-start"
              value={preferences.week_start}
              onChange={(e) => setPreference("week_start", Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
            >
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
            <p className="mt-1 text-xs text-muted">
              Used by the Calendar week view and the Habits week progress.
            </p>
          </div>

          <div>
            <label htmlFor="settings-time-format" className="mb-1.5 block text-sm font-medium">
              Time format
            </label>
            <select
              id="settings-time-format"
              value={preferences.time_format}
              onChange={(e) => handleTimeFormatChange(e.target.value as "12h" | "24h")}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
            >
              <option value="24h">24-hour (14:30)</option>
              <option value="12h">12-hour (2:30 PM)</option>
            </select>
            <p className="mt-1 text-xs text-muted">Saves on its own, immediately.</p>
          </div>
        </div>
      </fieldset>

      {/* Task defaults -------------------------------------------------- */}
      <fieldset className="space-y-3 border-t border-border pt-6">
        <legend className="text-sm font-semibold">Task defaults</legend>
        <p className="text-xs text-muted">
          Applied to new tasks you create from Tasks or the Calendar, unless you change
          the field yourself.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="settings-default-category"
            label="Default category"
            value={preferences.default_task_category ?? ""}
            onChange={(v) => setPreference("default_task_category", v || null)}
            error={fieldErrors.default_task_category}
            placeholder="e.g. Study"
          />

          <div>
            <label
              htmlFor="settings-default-priority"
              className="mb-1.5 block text-sm font-medium"
            >
              Default priority
            </label>
            <select
              id="settings-default-priority"
              value={preferences.default_task_priority ?? ""}
              onChange={(e) =>
                setPreference(
                  "default_task_priority",
                  (e.target.value || null) as TaskPriority | null,
                )
              }
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
            >
              {PRIORITIES.map((value) => (
                <option key={value || "none"} value={value}>
                  {value === ""
                    ? "Medium (built-in default)"
                    : value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
            {fieldErrors.default_task_priority ? (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {fieldErrors.default_task_priority}
              </p>
            ) : null}
          </div>
        </div>

        {/* Real toggle with a real effect on the Tasks list and the Calendar. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-app p-3.5">
          <input
            type="checkbox"
            checked={preferences.show_completed_tasks}
            onChange={(e) => setPreference("show_completed_tasks", e.target.checked)}
            className="mt-0.5 shrink-0 cursor-pointer rounded border-border accent-[rgb(var(--accent))]"
            style={{ height: "1.125rem", width: "1.125rem" }}
          />
          <span>
            <span className="block text-sm font-medium">Show completed tasks</span>
            <span className="mt-0.5 block text-xs text-muted">
              When off, the Tasks list and the Calendar hide tasks you have finished. Their
              history is kept either way.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex justify-end border-t border-border pt-5">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-40"
        >
          {pending ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
