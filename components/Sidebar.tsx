"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { Icon } from "@/components/icons";

// Navigation shell. Renders in two shapes from the same NAV_ITEMS list:
//   - `sidebar`: vertical rail, hidden below `lg`, sticky on desktop.
//   - `bottom`:  fixed bottom bar, shown only below `lg`.
// `usePathname` marks the active route, so a link highlights itself.

type Variant = "sidebar" | "bottom";

/** True when `href` is the current route (or a nested route under it). */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ variant }: { variant: Variant }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    // Mobile: icon + short label per item, evenly split across the width.
    return (
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-18 items-stretch border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${active ? "text-accent" : "text-muted hover:text-accent"
                }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  // Desktop: brand header + vertical link list.
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-18 items-center gap-2 px-6">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
          D
        </span>
        <span className="text-lg font-semibold tracking-tight">DayForge</span>
      </div>

      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-accent-soft/60 hover:text-accent"
                }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
