"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Logs the user out, then sends them to /login.
// signOut() clears the session on the server and removes the local auth cookies.
export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();

    // replace (not push) so the back button does not return to a protected page,
    // and refresh so server components drop the old session.
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
      </svg>
      <span className="hidden sm:inline">
        {pending ? "Logging out..." : "Log out"}
      </span>
    </button>
  );
}
