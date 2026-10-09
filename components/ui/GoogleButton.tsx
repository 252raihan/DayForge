"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// "Continue with Google" button.
// Starts the OAuth flow: Supabase returns a URL to Google, and the browser is
// sent there. After the user approves, Google redirects back to Supabase and
// Supabase redirects back to /auth/callback in our app.
export default function GoogleButton({
  label = "Continue with Google",
  next = "/dashboard",
}: {
  label?: string;
  next?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Where Supabase sends the browser after Google approves. This URL must
        // be listed under Authentication -> URL Configuration -> Redirect URLs.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    // On success the browser navigates away, so we only get here on failure.
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
          />
        </svg>
        {pending ? "Redirecting..." : label}
      </button>

      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
