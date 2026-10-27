"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { Icon } from "@/components/icons";

// Navigation shell, rendered in three shapes from the same NAV_ITEMS list:
//   - `sidebar`: fixed dark rail on desktop (lg and up).
//   - `drawer`:  slide-in drawer for mobile, toggled from the Topbar.
//   - `bottom`:  fixed bottom bar kept for tablets below lg (unchanged).
//
// `usePathname` marks the active route; the active item gets a subtle indigo
// gradient instead of a flat fill, matching the redesigned dashboard.

type Variant = "sidebar" | "bottom" | "drawer";

/** True when `href` is the current route (or a nested route under it). */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The nav list itself, shared by the desktop rail and the mobile drawer. */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${active
                ? "bg-gradient-to-r from-indigo2 via-brand-500 to-brand-500/60 text-white shadow-glow"
                : "text-muted hover:bg-white/5 hover:text-white"
              }`}
          >
            <Icon
              name={item.icon}
              className={active ? "h-5 w-5 text-white" : "h-5 w-5 text-muted group-hover:text-white"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ variant, onClose }: { variant: Variant; onClose?: () => void }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    // Mobile bottom bar: icon + short label per item, evenly split.
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

  if (variant === "drawer") {
    return (
      <div className="flex h-full flex-col bg-surface lg:hidden">
        <div className="flex h-18 items-center gap-2 px-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 via-brand-500 to-electric-500 text-sm font-bold text-white">
            D
          </span>
          <span className="text-lg font-semibold tracking-tight">DayForge</span>
        </div>

        <NavList onNavigate={onClose} />

        <div className="border-t border-border p-3">
          <p className="rounded-xl bg-gradient-to-br from-brand-500/15 to-electric-500/10 px-3.5 py-3 text-xs font-medium text-muted">
            Small steps every day. <span className="font-semibold text-accent">Big results.</span>
          </p>
        </div>
      </div>
    );
  }

  // Desktop rail.
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-18 items-center gap-2.5 px-6">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-electric-500 text-sm font-bold text-white shadow-glow">
          D
        </span>
        <span className="text-lg font-semibold tracking-tight">DayForge</span>
      </div>

      <NavList />

      <div className="border-t border-border p-3">
        <p className="rounded-xl bg-gradient-to-br from-brand-500/15 to-electric-500/10 px-3.5 py-3.5 text-xs font-medium leading-relaxed text-muted">
          Small steps every day.
          <br />
          <span className="text-sm font-semibold text-white">Big results.</span>
        </p>
      </div>
    </aside>
  );
}
