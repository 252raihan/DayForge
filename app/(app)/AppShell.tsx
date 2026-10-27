"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

// The interactive half of the authenticated app shell.
//
// Drawer state lives here because the Topbar's menu button and the drawer
// itself need to share it. The auth check and the profile fetch happen in the
// server `layout.tsx` beside this file, which passes the resolved user down.

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

  return (
    <div className="flex min-h-screen bg-app">
      {/* Desktop-only vertical navigation. */}
      <Sidebar variant="sidebar" />

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
            className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-card">
            <Sidebar variant="drawer" onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={name} email={email} onOpenMenu={() => setMenuOpen(true)} />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile-only bottom navigation. */}
      <Sidebar variant="bottom" />
    </div>
  );
}
