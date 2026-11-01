"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SunIcon, MoonIcon } from "@/components/icons";

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
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={mounted ? isDark : undefined}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {/* Render a stable placeholder until mounted to keep SSR and client HTML equal. */}
      {!mounted ? (
        <span className="h-[18px] w-[18px]" />
      ) : isDark ? (
        <SunIcon className="h-[18px] w-[18px]" />
      ) : (
        <MoonIcon className="h-[18px] w-[18px]" />
      )}
    </Button>
  );
}
