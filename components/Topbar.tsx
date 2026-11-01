"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS } from "@/lib/nav";
import { MenuIcon, SearchIcon, CloseIcon, LogOutIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

// Top bar for the redesigned dashboard shell.
//
// Desktop: a global search field. Phones: the menu button, the page name and a
// search toggle that opens a full-width row.
//
// Search is a real cross-entity lookup against the signed-in user's own rows
// (RLS scopes everything), grouped by Tasks / Notes / Habits, debounced at
// 250ms. Results navigate with the router so no page reload happens. Opening
// search with "/" (when not typing in a field) matches the keyboard habit from
// Linear and Notion.

type SearchGroup = "tasks" | "notes" | "habits";

type SearchResult = {
  tasks: { id: string; title: string }[];
  notes: { id: string; title: string }[];
  habits: { id: string; title: string }[];
};

const EMPTY: SearchResult = { tasks: [], notes: [], habits: [] };

/** The current page's nav label, for the compact mobile header. */
function usePageLabel() {
  const [label, setLabel] = useState("DayForge");

  useEffect(() => {
    const path = window.location.pathname;
    const match = NAV_ITEMS.find(
      (item) => path === item.href || path.startsWith(`${item.href}/`),
    );
    setLabel(match?.label ?? "DayForge");
  }, []);

  return label;
}

export default function Topbar({
  name,
  email,
  menuOpen,
  onOpenMenu,
}: {
  name: string | null;
  email: string | null;
  /** Whether the mobile drawer is currently open. */
  menuOpen: boolean;
  /** Opens the mobile drawer (owned by the app layout). */
  onOpenMenu: () => void;
}) {
  const displayName = name?.trim() || email?.split("@")[0] || "there";
  const initial = displayName.charAt(0).toUpperCase();
  const pageLabel = usePageLabel();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  // "/" focuses the search box, unless the user is already typing somewhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      if (window.matchMedia("(min-width: 1024px)").matches) {
        searchRef.current?.focus();
      } else {
        setMobileSearch(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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
      (
        [
          { key: "tasks" as SearchGroup, label: "Tasks", hrefBase: "/tasks", items: results.tasks },
          { key: "notes" as SearchGroup, label: "Notes", hrefBase: "/notes", items: results.notes },
          { key: "habits" as SearchGroup, label: "Habits", hrefBase: "/habits", items: results.habits },
        ]
      ).filter((group) => group.items.length > 0),
    [results],
  );

  function closeSearch() {
    setOpen(false);
    setQuery("");
    setMobileSearch(false);
  }

  function pick(href: string, id: string) {
    closeSearch();
    // Deep-link where the route supports it, otherwise land on the list.
    router.push(`${href}?focus=${id}`);
  }

  const searchBox = (
    <div className="relative w-full">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
        <SearchIcon className="h-4 w-4" />
      </span>
      <Input
        ref={searchRef}
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
        className="h-9 bg-surface-2 pl-8.5 pr-12 text-[13px] shadow-none"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center rounded border border-border bg-surface px-1.5 py-px text-3xs font-medium text-muted sm:flex"
      >
        /
      </kbd>

      {open && debounced.length >= 2 ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-overlay"
          role="listbox"
          aria-label="Search results"
        >
          {searching ? (
            <p className="px-3.5 py-3 text-xs text-muted">Searching…</p>
          ) : hasResults ? (
            <div className="scrollbar-thin max-h-80 overflow-y-auto py-1.5">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="px-3.5 pb-1 pt-2 text-3xs font-semibold uppercase tracking-[0.08em] text-muted">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={`${group.label}-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => pick(group.hrefBase, item.id)}
                      className="block w-full truncate rounded-md px-3.5 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-3.5 py-3 text-xs text-muted">No matches for “{debounced}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-app/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:h-16 lg:gap-4 lg:px-8">
        {/* Phones/tablets: drawer toggle + current page. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          className="lg:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>

        <span className="truncate text-[15px] font-semibold tracking-tight text-fg lg:hidden">
          {pageLabel}
        </span>

        <div className="hidden min-w-0 flex-1 lg:block lg:max-w-sm">{searchBox}</div>
        <div className="flex-1 lg:hidden" />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Mobile search toggle. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSearch((v) => !v)}
            aria-label={mobileSearch ? "Close search" : "Open search"}
            aria-expanded={mobileSearch}
            className="lg:hidden"
          >
            {mobileSearch ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <SearchIcon className="h-5 w-5" />
            )}
          </Button>

          <ThemeToggle />

          <AccountMenu displayName={displayName} initial={initial} email={email} />
        </div>
      </div>

      {/* Mobile search row, revealed in place so the layout does not jump. */}
      {mobileSearch ? <div className="px-4 pb-3 lg:hidden">{searchBox}</div> : null}
    </header>
  );
}

/** Avatar button that opens a small account popover (identity, settings, out). */
function AccountMenu({
  displayName,
  initial,
  email,
}: {
  displayName: string;
  initial: string;
  email: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full p-0.5 pr-0 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:pr-2"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[9rem] truncate text-[13px] font-medium text-fg sm:inline">
          {displayName}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-border bg-surface shadow-overlay"
        >
          <div className="border-b border-border px-3.5 py-3">
            <p className="truncate text-[13px] font-medium text-fg">{displayName}</p>
            {email ? <p className="mt-0.5 truncate text-xs text-muted">{email}</p> : null}
          </div>
          <div className="p-1.5">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
            >
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2 disabled:opacity-60",
              )}
            >
              <LogOutIcon className="h-4 w-4 text-muted" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
