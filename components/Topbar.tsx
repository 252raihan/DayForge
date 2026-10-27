"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/client";

// Top bar for the redesigned dashboard shell.
//
// Desktop: a global search box on the left, theme toggle + avatar + logout on
// the right. Mobile: the brand, a search icon that opens a full-width row, and
// the same right-side controls.
//
// Search is a real cross-entity lookup against the signed-in user's own rows
// (RLS scopes everything), grouped by Tasks / Notes / Habits, and it debounces
// at 250ms. It navigates with the router so no page reload happens.

type SearchResult = {
  tasks: { id: string; title: string }[];
  notes: { id: string; title: string }[];
  habits: { id: string; title: string }[];
};

const EMPTY: SearchResult = { tasks: [], notes: [], habits: [] };

export default function Topbar({
  name,
  email,
  onOpenMenu,
}: {
  name: string | null;
  email: string | null;
  /** Opens the mobile drawer (owned by the app layout). */
  onOpenMenu: () => void;
}) {
  const displayName = name?.trim() || email?.split("@")[0] || "Student";
  const initial = displayName.charAt(0).toUpperCase();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const supabase = createClient();

    void (async () => {
      const term = `%${debounced}%`;
      const [tasks, notes, habits] = await Promise.all([
        supabase.from("tasks").select("id,title").ilike("title", term).limit(5),
        supabase.from("notes").select("id,title").ilike("title", term).limit(3),
        supabase.from("habits").select("id,title").ilike("title", term).limit(3),
      ]);

      if (cancelled) return;
      setResults({
        tasks: (tasks.data as SearchResult["tasks"]) ?? [],
        notes: (notes.data as SearchResult["notes"]) ?? [],
        habits: (habits.data as SearchResult["habits"]) ?? [],
      });
      setSearching(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // A result row navigates, which unmounts the panel; closing on blur would
  // race the click, so the panel only closes via Escape, an explicit X or after
  // picking a result.
  const hasResults =
    results.tasks.length + results.notes.length + results.habits.length > 0;

  const groups = useMemo(
    () =>
      [
        { label: "Tasks", hrefBase: "/tasks", items: results.tasks },
        { label: "Notes", hrefBase: "/notes", items: results.notes },
        { label: "Habits", hrefBase: "/habits", items: results.habits },
      ].filter((group) => group.items.length > 0),
    [results],
  );

  function pick(href: string) {
    setOpen(false);
    setQuery("");
    setMobileSearch(false);
    // Navigation happens via the Link; this just closes the panel.
    void href;
  }

  const searchBox = (
    <div className="relative w-full max-w-md">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Search tasks, notes, habits…"
        aria-label="Search tasks, notes and habits"
        className="w-full rounded-xl border border-border bg-app/60 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30"
      />

      {open && debounced.length >= 2 ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-card"
          role="listbox"
          aria-label="Search results"
        >
          {searching ? (
            <p className="px-4 py-3 text-xs text-muted">Searching…</p>
          ) : hasResults ? (
            <div className="max-h-80 overflow-y-auto py-1">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={`${group.label}-${item.id}`}
                      href={group.hrefBase}
                      onClick={() => pick(group.hrefBase)}
                      className="block truncate px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-white/5"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-muted">No matches for “{debounced}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/70 px-4 backdrop-blur sm:px-6">
      <div className="flex h-18 items-center gap-3">
        {/* Mobile: menu + brand. */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          aria-expanded={false}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-white/5 hover:text-white lg:hidden"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="sr-only">Menu</span>
        </button>

        <span className="text-base font-semibold tracking-tight lg:hidden">DayForge</span>

        <div className="hidden min-w-0 flex-1 lg:block">{searchBox}</div>
        <div className="flex-1 lg:hidden" />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Mobile search toggle. */}
          <button
            type="button"
            onClick={() => setMobileSearch((v) => !v)}
            aria-label={mobileSearch ? "Close search" : "Open search"}
            aria-expanded={mobileSearch}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          >
            {mobileSearch ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            )}
          </button>

          <ThemeToggle />

          <div
            className="flex items-center gap-2 rounded-full border border-border bg-app/60 py-1 pl-1 pr-3"
            title={email ?? undefined}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-400 via-brand-500 to-electric-500 text-xs font-bold text-white">
              {initial}
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
              {displayName}
            </span>
          </div>

          <LogoutButton />
        </div>
      </div>

      {/* Mobile search row, revealed in place so the layout does not jump. */}
      {mobileSearch ? (
        <div className="pb-3 lg:hidden">{searchBox}</div>
      ) : null}
    </header>
  );
}
