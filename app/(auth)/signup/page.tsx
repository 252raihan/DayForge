"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/ui/AuthCard";
import GoogleButton from "@/components/ui/GoogleButton";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import {
  friendlyAuthError,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/validation";

// /signup - creates the account and stores the name in user metadata, which the
// database trigger reads to populate profiles.name.
export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set when email confirmation is required, to swap the form for a notice.
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next = {
      name: validateName(name) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: validateConfirmPassword(password, confirm) ?? undefined,
    };
    setErrors(next);
    if (next.name || next.email || next.password || next.confirm) return;

    setPending(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Becomes raw_user_meta_data.name, used by handle_new_user() to seed
        // the profiles row.
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setFormError(friendlyAuthError(error.message));
      setPending(false);
      return;
    }

    // With email confirmation ON, Supabase returns no session until the user
    // clicks the link. Show a "check your inbox" screen instead of redirecting.
    if (!data.session) {
      setCheckEmail(true);
      setPending(false);
      return;
    }

    // Confirmation disabled: they are already signed in.
    window.location.href = "/dashboard";
  }

  if (checkEmail) {
    return (
      <AuthCard
        title="Confirm your email"
        subtitle="One more step before you can log in."
        footer={
          <Link href="/login" className="font-medium text-accent hover:underline">
            Back to log in
          </Link>
        }
      >
        <FormMessage tone="success">
          We sent a confirmation link to <strong>{email.trim()}</strong>. Click it
          to activate your account.
        </FormMessage>
        <p className="mt-4 text-sm text-muted">
          Nothing arrived? Check your spam folder, and make sure the address is
          spelled correctly.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building a routine that actually fits your semester."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? <FormMessage>{formError}</FormMessage> : null}

        <Field
          id="name"
          label="Name"
          value={name}
          onChange={setName}
          error={errors.name}
          placeholder="Your full name"
          autoComplete="name"
          required
        />

        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          placeholder="you@university.edu"
          autoComplete="email"
          required
        />

        <Field
          id="password"
          label="Password"
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
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          autoComplete="new-password"
          required
        />

        <SubmitButton pending={pending} pendingLabel="Creating account...">
          Create account
        </SubmitButton>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Sign up with Google" />
    </AuthCard>
  );
}
