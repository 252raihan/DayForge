"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

// The interactive half of the authenticated app shell.
//
// State kept here because two children share it:
//   - `menuOpen`: the drawer, opened from the Topbar menu button.
//   - `collapsed`: the desktop rail width, persisted in localStorage so the
//     choice survives navigation and reloads.
//
// The auth check and the profile fetch happen in the server `layout.tsx` beside
// this file, which passes the resolved user down.

const COLLAPSE_KEY = "dayforge:sidebar-collapsed";

export default function AppLayoutShell({
  children,
  name,
  email,
}: {
  children: React.ReactNode;
  name: string | null;
  email: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the rail preference after mount (the server cannot know it, and
  // reading it during render would break hydration).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode: keep the default expanded rail */
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* preference just will not persist */
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-app">
      {/* Keyboard users can jump straight past the navigation. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3.5 focus:py-2 focus:text-[13px] focus:font-medium focus:text-accent focus:shadow-overlay focus:ring-1 focus:ring-border"
      >
        Skip to content
      </a>

      {/* Desktop rail (expanded or collapsed). */}
      <Sidebar
        variant="sidebar"
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Mobile drawer + scrim. Rendered only while open so nothing is tabbable
          behind a closed drawer. */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 w-[17rem] border-r border-border bg-surface shadow-overlay">
            <Sidebar variant="drawer" onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={name}
          email={email}
          menuOpen={menuOpen}
          onOpenMenu={() => setMenuOpen(true)}
        />

        <main
          id="main-content"
          className="mx-auto w-full max-w-[80rem] flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10"
        >
          {children}
        </main>
      </div>

      {/* Phone bottom navigation. */}
      <Sidebar variant="bottom" />
    </div>
  );
}
