"use client";

import { useState, useTransition } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { updateProfile } from "@/app/(app)/settings/actions";
import type { ProfileUpdate } from "@/types";

// Settings form. Holds the four editable profile fields in local state, does a
// quick client-side check, then hands off to the server action which validates
// again and writes to Supabase.
export default function ProfileForm({
  initialValues,
  email,
}: {
  initialValues: ProfileUpdate;
  email: string | null;
}) {
  const [values, setValues] = useState<ProfileUpdate>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProfileUpdate, string>>
  >({});
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  // useTransition keeps the form responsive while the server action runs.
  const [pending, startTransition] = useTransition();

  function setField(field: keyof ProfileUpdate, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear that field's error as soon as the user edits it.
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setMessage(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    // Cheap client-side checks first, to avoid a pointless round-trip.
    const next: typeof fieldErrors = {};
    if ((values.name?.length ?? 0) > 80) {
      next.name = "That name is too long (80 characters max).";
    }
    if ((values.university?.length ?? 0) > 120) {
      next.university = "That's too long (120 characters max).";
    }
    if ((values.department?.length ?? 0) > 120) {
      next.department = "That's too long (120 characters max).";
    }
    if ((values.semester?.length ?? 0) > 40) {
      next.semester = "That's too long (40 characters max).";
    }

    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      setMessage({ tone: "error", text: "Please fix the highlighted fields." });
      return;
    }

    startTransition(async () => {
      const result = await updateProfile(values);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage({ tone: "error", text: result.message });
        return;
      }

      setMessage({ tone: "success", text: result.message });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <Field
        id="name"
        label="Name"
        value={values.name ?? ""}
        onChange={(v) => setField("name", v)}
        error={fieldErrors.name}
        placeholder="Your full name"
        autoComplete="name"
      />

      {/* Email is managed by Supabase Auth, so it is shown read-only here. */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
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
        id="university"
        label="University"
        value={values.university ?? ""}
        onChange={(v) => setField("university", v)}
        error={fieldErrors.university}
        placeholder="e.g. University of Dhaka"
        autoComplete="organization"
      />

      <Field
        id="department"
        label="Department"
        value={values.department ?? ""}
        onChange={(v) => setField("department", v)}
        error={fieldErrors.department}
        placeholder="e.g. Computer Science & Engineering"
      />

      <Field
        id="semester"
        label="Semester"
        value={values.semester ?? ""}
        onChange={(v) => setField("semester", v)}
        error={fieldErrors.semester}
        placeholder="e.g. 6th"
      />

      <div className="flex justify-end pt-1">
        <div className="w-full sm:w-auto">
          <SubmitButton pending={pending} pendingLabel="Saving...">
            Save changes
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
