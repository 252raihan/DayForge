"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/ui/AuthCard";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { friendlyAuthError, validateConfirmPassword, validatePassword } from "@/lib/validation";

// /reset-password - sets a new password.
//
// Reached from the emailed link via /auth/callback, which creates a short-lived
// recovery session. That session is what allows updateUser() to work here.
// If the link was already used or expired there is no session, so we show an
// "expired link" screen instead of a form that would fail on submit.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  // Check for a recovery session on mount.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setReady(Boolean(data.user)));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next = {
      password: validatePassword(password) ?? undefined,
      confirm: validateConfirmPassword(password, confirm) ?? undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setPending(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFormError(friendlyAuthError(error.message));
      setPending(false);
      return;
    }

    setDone(true);
    setPending(false);
    // Give the user a moment to read the confirmation, then send them on.
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1500);
  }

  // Still checking for a session.
  if (ready === null) {
    return (
      <AuthCard title="Reset your password">
        <p className="text-sm text-muted">Checking your reset link...</p>
      </AuthCard>
    );
  }

  // No recovery session: the link is stale or was already used.
  if (!ready) {
    return (
      <AuthCard
        title="This link has expired"
        subtitle="Password reset links can only be used once."
        footer={
          <Link href="/login" className="font-medium text-accent hover:underline">
            Back to log in
          </Link>
        }
      >
        <Link
          href="/forgot-password"
          className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="Taking you to your dashboard...">
        <FormMessage tone="success">
          Your password has been changed. Use it next time you log in.
        </FormMessage>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Pick something you haven't used before."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? <FormMessage>{formError}</FormMessage> : null}

        <Field
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
          hint="At least 8 characters."
          required
        />

        <Field
          id="confirm"
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          autoComplete="new-password"
          required
        />

        <SubmitButton pending={pending} pendingLabel="Updating...">
          Update password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
