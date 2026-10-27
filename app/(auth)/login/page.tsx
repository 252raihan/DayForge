"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleButton from "@/components/ui/GoogleButton";
import { SubmitButton } from "@/components/ui/Form";
import AuthSplitLayout, { AuthPanel } from "@/components/auth/AuthSplitLayout";
import AuthLogo from "@/components/auth/AuthLogo";
import { AuthAlert, IconField, PasswordField } from "@/components/auth/AuthFields";
import { friendlyAuthError, validateEmail } from "@/lib/validation";

// /login - email + password, plus Google.
//
// useSearchParams() opts the component into client-side rendering, so the part
// that reads `?next=` lives in LoginForm and is wrapped in Suspense below. That
// keeps the rest of the route statically renderable at build time.
//
// The redesign is presentation only: the Supabase call, the validation, the
// `next` redirect and the loading states are unchanged.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

// Shown while the client bundle for LoginForm loads. Same frame, so there is no
// layout shift when the real form takes over.
function LoginFallback() {
  return (
    <AuthSplitLayout>
      <AuthPanel>
        <AuthCardHeader />
        <p className="text-sm text-slate-400" role="status">
          Loading…
        </p>
      </AuthPanel>
    </AuthSplitLayout>
  );
}

/** Logo + heading shared by the fallback and the real form. */
function AuthCardHeader() {
  return (
    <div className="mb-7">
      <div className="mb-6 flex justify-center">
        <Link href="/" className="rounded-2xl" aria-label="DayForge home">
          <AuthLogo size="sm" />
        </Link>
      </div>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
        Welcome Back
      </h1>
      <p className="mt-2 text-center text-sm text-slate-400">
        Log in to continue your routine where you left off.
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Middleware adds ?next=<path> so we can return the user where they wanted to go.
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Guard against a second submit while the first is still in flight.
    if (pending) return;
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

    // "Remember me": when unchecked, the Supabase session cookies are turned
    // into browser-session cookies, so closing the browser signs the user out.
    // The auth session itself is untouched either way.
    if (!remember) makeSessionCookiesTemporary();

    // Refresh so server components pick up the new session cookie, then go.
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthSplitLayout>
      <AuthPanel>
        <AuthCardHeader />

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError ? <AuthAlert>{formError}</AuthAlert> : null}

          <IconField
            id="email"
            label="Email"
            icon="mail"
            type="email"
            value={email}
            onChange={setEmail}
            error={errors.email}
            placeholder="you@university.edu"
            autoComplete="email"
            required
          />

          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            autoComplete="current-password"
            required
            labelAction={
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-brand-300 transition-colors hover:text-brand-400 hover:underline"
              >
                Forgot password?
              </Link>
            }
          />

          {/* Remember me */}
          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-white/20 bg-navy-950/60 accent-[#7468FF]"
            />
            Remember me
          </label>

          <SubmitButton tone="gradient" pending={pending} pendingLabel="Logging in…">
            Log in
          </SubmitButton>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            or
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <GoogleButton label="Continue with Google" next={next} tone="glass" />

        <p className="mt-7 text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand-300 transition-colors hover:text-brand-400 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </AuthPanel>

      <p className="mt-5 text-center text-[11px] text-slate-500 lg:hidden">
        Small steps every day → Big results.
      </p>
    </AuthSplitLayout>
  );
}

/**
 * Turns the Supabase session cookies into browser-session cookies.
 *
 * Supabase always sets a long expiry on its cookies. Re-writing them with no
 * `max-age` / `expires` makes the browser drop them when it closes, which is
 * exactly what "don't remember me" means. Nothing else about the session
 * changes, and if no cookie can be found we simply do nothing.
 */
function makeSessionCookiesTemporary() {
  try {
    const cookies = document.cookie ? document.cookie.split(";") : [];
    for (const raw of cookies) {
      const [name] = raw.trim().split("=");
      if (!name || !name.startsWith("sb-") || !name.endsWith("-auth-token")) continue;
      document.cookie = `${name}=; path=/; SameSite=Lax`;
    }
  } catch {
    // Cookie access can be blocked; the login itself already succeeded.
  }
}
