"use client";

import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";

// Top bar: brand on mobile, user identity and controls on the right.
// Sticks to the top of the content column and blurs the page behind it.
//
// The user's name arrives as props from the (app) layout, which reads it from
// Supabase on the server, so the real identity is resolved before render.
export default function Topbar({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  // Show the name if we have one, otherwise fall back to the email's local part
  // (e.g. "raihan@uni.edu" -> "raihan").
  const displayName = name?.trim() || email?.split("@")[0] || "Student";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6">
      <div className="min-w-0 lg:hidden">
        {/* On mobile the desktop sidebar is hidden, so show the brand here. */}
        <span className="text-base font-semibold tracking-tight">DayForge</span>
      </div>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />

        <div
          className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3"
          title={email ?? undefined}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {initial}
          </span>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
            {displayName}
          </span>
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}
