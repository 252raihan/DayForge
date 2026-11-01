"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  SelectField,
} from "@/components/ui";
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

const THEMES: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Bright, high contrast" },
  { value: "dark", label: "Dark", hint: "Low light, easy on the eyes" },
  { value: "system", label: "System", hint: "Follow your device" },
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
      {message ? (
        <Alert
          tone={message.tone}
          onDismiss={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      ) : null}

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
        <Field
          id="settings-email"
          label="Email"
          type="email"
          value={email ?? ""}
          onChange={() => {}}
          readOnly
          disabled
          hint="Your email is your login and can't be changed here."
        />

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
        <legend className="text-sm font-semibold tracking-tight text-fg">Appearance</legend>
        <p className="text-2xs text-muted">
          Saved to your account, so it follows you to a new device.
        </p>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">Theme</p>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid grid-cols-3 gap-2 sm:max-w-md"
          >
            {THEMES.map((option) => {
              const selected = preferences.theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => applyTheme(option.value)}
                  className={`group rounded-lg border p-2 text-left transition-colors ${
                    selected
                      ? "border-accent/50 bg-accent-soft"
                      : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  {/* A miniature of the theme: page, sidebar and a card. */}
                  <span
                    className={`mb-2 flex h-12 w-full gap-1 overflow-hidden rounded-md border p-1 ${
                      option.value === "dark"
                        ? "border-slate-700 bg-slate-900"
                        : option.value === "light"
                          ? "border-slate-200 bg-slate-50"
                          : "border-slate-300 bg-gradient-to-r from-slate-100 to-slate-900"
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`h-full w-1/4 rounded-sm ${
                        option.value === "dark" ? "bg-slate-800" : "bg-white ring-1 ring-slate-200"
                      }`}
                    />
                    <span className="flex flex-1 flex-col gap-1 pt-0.5">
                      <span
                        className={`h-1.5 w-3/4 rounded-full ${
                          option.value === "dark" ? "bg-slate-600" : "bg-slate-300"
                        }`}
                      />
                      <span
                        className={`h-1.5 w-1/2 rounded-full ${
                          option.value === "dark" ? "bg-slate-700" : "bg-slate-200"
                        }`}
                      />
                      <span className="mt-auto h-3 w-full rounded-sm bg-indigo-500/70" />
                    </span>
                  </span>

                  <span className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-medium ${
                        selected ? "text-accent" : "text-fg"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                        selected ? "border-accent bg-accent" : "border-border-strong"
                      }`}
                      aria-hidden="true"
                    >
                      {selected ? (
                        <svg
                          className="h-2.5 w-2.5 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 12.5 4.5 4.5L19 7" />
                        </svg>
                      ) : null}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-3xs text-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-2xs leading-relaxed text-muted">
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
          <SelectField
            id="settings-week-start"
            label="Week starts on"
            value={preferences.week_start}
            onChange={(value) => setPreference("week_start", Number(value))}
            hint="Used by the Calendar week view and the Habits week progress."
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </SelectField>

          <SelectField
            id="settings-time-format"
            label="Time format"
            value={preferences.time_format}
            onChange={(value) => handleTimeFormatChange(value as "12h" | "24h")}
            hint="Saves on its own, immediately."
          >
            <option value="24h">24-hour (14:30)</option>
            <option value="12h">12-hour (2:30 PM)</option>
          </SelectField>
        </div>
      </fieldset>

      {/* Task defaults -------------------------------------------------- */}
      <fieldset className="space-y-3 border-t border-border pt-6">
        <legend className="text-sm font-semibold tracking-tight text-fg">Task defaults</legend>
        <p className="text-2xs leading-relaxed text-muted">
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

          <SelectField
            id="settings-default-priority"
            label="Default priority"
            value={preferences.default_task_priority ?? ""}
            onChange={(value) =>
              setPreference(
                "default_task_priority",
                (value || null) as TaskPriority | null,
              )
            }
            error={fieldErrors.default_task_priority}
          >
            {PRIORITIES.map((value) => (
              <option key={value || "none"} value={value}>
                {value === ""
                  ? "Medium (built-in default)"
                  : value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </SelectField>
        </div>

        {/* Real toggle with a real effect on the Tasks list and the Calendar. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-2/60 p-3.5">
          <Checkbox
            checked={preferences.show_completed_tasks}
            onChange={(e) => setPreference("show_completed_tasks", e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-[13px] font-medium text-fg">
              Show completed tasks
            </span>
            <span className="mt-0.5 block text-2xs leading-relaxed text-muted">
              When off, the Tasks list and the Calendar hide tasks you have finished. Their
              history is kept either way.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex justify-end border-t border-border pt-5">
        <Button
          type="submit"
          loading={pending}
          loadingLabel="Saving..."
          className="w-full sm:w-36"
        >
          Save settings
        </Button>
      </div>
    </form>
  );
}
