"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/ui/AuthCard";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { friendlyAuthError, validateEmail } from "@/lib/validation";

// /forgot-password - sends the reset email.
// Always shows the same success message, whether or not the address is
// registered. This stops the page being used to discover who has an account.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;

    setPending(true);
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Where the emailed link lands. Supabase exchanges the token there and
      // signs the user in, then our page lets them set a new password.
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    // A rate-limit error is worth surfacing; anything else we hide so the page
    // does not leak whether the account exists.
    if (error && friendlyAuthError(error.message).toLowerCase().includes("too many")) {
      setFormError(friendlyAuthError(error.message));
      setPending(false);
      return;
    }

    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If an account exists for that address, we've sent a reset link."
        footer={
          <Link href="/login" className="font-medium text-accent hover:underline">
            Back to log in
          </Link>
        }
      >
        <FormMessage tone="success">
          We sent password reset instructions to <strong>{email.trim()}</strong>.
        </FormMessage>
        <p className="mt-4 text-sm text-muted">
          The link expires shortly, so use it soon. Didn&apos;t get it? Check your
          spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium text-accent hover:underline"
          >
            try again
          </button>
          .
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? <FormMessage>{formError}</FormMessage> : null}

        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={error}
          placeholder="you@university.edu"
          autoComplete="email"
          required
        />

        <SubmitButton pending={pending} pendingLabel="Sending link...">
          Send reset link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
