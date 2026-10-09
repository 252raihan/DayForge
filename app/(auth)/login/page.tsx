"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/ui/AuthCard";
import GoogleButton from "@/components/ui/GoogleButton";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { friendlyAuthError, validateEmail } from "@/lib/validation";

// /login - email + password, plus Google.
//
// useSearchParams() opts the component into client-side rendering, so the part
// that reads `?next=` lives in LoginForm and is wrapped in Suspense below. That
// keeps the rest of the route statically renderable at build time.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

// Shown while the client bundle for LoginForm loads.
function LoginFallback() {
  return (
    <AuthCard title="Welcome back" subtitle="Log in to pick up your routine where you left off.">
      <p className="text-sm text-muted">Loading...</p>
    </AuthCard>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Middleware adds ?next=<path> so we can return the user where they wanted to go.
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validate before hitting the network.
    const emailError = validateEmail(email);
    const passwordError = password ? null : "Enter your password.";
    setErrors({ email: emailError ?? undefined, password: passwordError ?? undefined });
    if (emailError || passwordError) return;

    setPending(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setFormError(friendlyAuthError(error.message));
      setPending(false);
      return;
    }

    // Refresh so server components pick up the new session cookie, then go.
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to pick up your routine where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Sign up
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
          error={errors.email}
          placeholder="you@university.edu"
          autoComplete="email"
          required
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-accent hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-accent/40 ${errors.password
                ? "border-red-400 focus:border-red-500"
                : "border-border focus:border-accent"
              }`}
          />
          {errors.password ? (
            <p id="password-error" className="text-xs font-medium text-red-600 dark:text-red-400">
              {errors.password}
            </p>
          ) : null}
        </div>

        <SubmitButton pending={pending} pendingLabel="Logging in...">
          Log in
        </SubmitButton>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Continue with Google" next={next} />
    </AuthCard>
  );
}
