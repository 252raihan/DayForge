"use client";

import { useEffect, useState } from "react";

// Dark/light toggle.
// The actual `dark` class is applied before paint by the inline script in
// app/layout.tsx, so this component only mirrors that state and writes changes
// back to localStorage. `mounted` avoids a hydration mismatch, since the server
// cannot know what theme the client resolved to.
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Sync with whatever the pre-paint script decided.
  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    // Persist so the choice survives reloads and new tabs.
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={mounted ? isDark : undefined}
      title={isDark ? "Light mode" : "Dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-accent-soft hover:text-accent"
    >
      {/* Render a stable placeholder until mounted to keep SSR and client HTML equal. */}
      {!mounted ? (
        <span className="h-5 w-5" />
      ) : isDark ? (
        // Sun
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Moon
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
