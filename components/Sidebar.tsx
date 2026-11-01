"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, navGroup, type NavGroup } from "@/lib/nav";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

// Navigation shell, rendered in four shapes from the same NAV_ITEMS list:
//   - `sidebar`: desktop rail (lg and up), collapsible to an icon rail.
//   - `drawer`:  slide-in drawer for tablets/phones, toggled from the Topbar.
//   - `bottom`:  fixed bottom bar on phones.
//
// `usePathname` marks the active route. The active item uses a tinted fill plus
// an accent icon - no gradient, no glow - so it reads as "selected" without
// competing with the page content.

export type SidebarVariant = "sidebar" | "bottom" | "drawer";

/** True when `href` is the current route (or a nested route under it). */
export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Brand mark: a forged-square glyph plus the wordmark. */
function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2",
        collapsed && "justify-center px-0",
      )}
      aria-label="DayForge home"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-white shadow-xs">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z" />
          <path d="m8.4 12 2.4 2.4 4.8-4.8" />
        </svg>
      </span>
      {!collapsed ? (
        <span className="truncate text-[15px] font-semibold tracking-tight text-fg">
          DayForge
        </span>
      ) : null}
    </Link>
  );
}

/** One nav row, shared by the expanded rail, the collapsed rail and the drawer. */
function NavLink({
  href,
  label,
  icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        collapsed ? "h-9 w-9 justify-center" : "h-9 gap-2.5 px-2.5",
        active
          ? "bg-accent-soft text-accent"
          : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon
        name={icon}
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-accent" : "text-muted group-hover:text-fg",
        )}
        strokeWidth={active ? 2 : 1.75}
      />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

/** The nav list, grouped by section with quiet labels. */
function NavList({
  onNavigate,
  collapsed = false,
  showGroupLabels = true,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  showGroupLabels?: boolean;
}) {
  const pathname = usePathname();
  const groups: NavGroup[] = ["plan", "grow", "account"];

  return (
    <nav
      aria-label="Main navigation"
      className={cn("flex flex-1 flex-col gap-4 overflow-y-auto p-3", collapsed && "px-2.5")}
    >
      {groups.map((group, groupIndex) => {
        const items = NAV_ITEMS.filter((item) => navGroup(item.href) === group);
        if (items.length === 0) return null;

        return (
          <div key={group} className="flex flex-col gap-0.5">
            {showGroupLabels && !collapsed ? (
              <p className="mb-1 px-2.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted/80">
                {group === "plan" ? "Plan" : group === "grow" ? "Grow" : "Account"}
              </p>
            ) : groupIndex > 0 ? (
              // In the collapsed rail a hairline stands in for the label.
              <div className="mx-auto mb-1 h-px w-6 bg-border" aria-hidden="true" />
            ) : null}

            {items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(pathname, item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

export default function Sidebar({
  variant,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  variant: SidebarVariant;
  onClose?: () => void;
  /** Desktop rail width state (ignored by the drawer and bottom bar). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();

  if (variant === "bottom") {
    // Phone bottom bar: five destinations max, so Settings and Notes collapse
    // into "More" via the drawer. Kept to the 5 most-used routes here.
    const bottomItems = NAV_ITEMS.filter((item) =>
      ["/dashboard", "/tasks", "/calendar", "/habits", "/notes"].includes(item.href),
    );

    return (
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="flex h-16 items-stretch">
          {bottomItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 touch-manipulation flex-col items-center justify-center gap-1 text-3xs font-medium transition-colors",
                  active ? "text-accent" : "text-muted active:text-fg",
                )}
              >
                {/* A 2px indicator replaces the colour-only active state. */}
                {active ? (
                  <span
                    className="absolute inset-x-0 top-0 mx-auto h-0.5 w-6 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  name={item.icon}
                  className="h-[20px] w-[20px]"
                  strokeWidth={active ? 2 : 1.75}
                />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}

          {/* Settings lives on the far edge; it is not a "daily" destination. */}
          <Link
            href="/settings"
            aria-current={isActive(pathname, "/settings") ? "page" : undefined}
            className={cn(
              "relative flex flex-1 touch-manipulation flex-col items-center justify-center gap-1 text-3xs font-medium transition-colors",
              isActive(pathname, "/settings") ? "text-accent" : "text-muted active:text-fg",
            )}
          >
            {isActive(pathname, "/settings") ? (
              <span
                className="absolute inset-x-0 top-0 mx-auto h-0.5 w-6 rounded-full bg-accent"
                aria-hidden="true"
              />
            ) : null}
            <Icon name="settings" className="h-[20px] w-[20px]" strokeWidth={1.75} />
            <span>Settings</span>
          </Link>
        </div>
      </nav>
    );
  }

  if (variant === "drawer") {
    return (
      <div className="flex h-full flex-col bg-surface lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <NavList onNavigate={onClose} showGroupLabels />

        <div className="border-t border-border p-3">
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
            Small, consistent steps.
            <br />
            <span className="font-medium text-fg">That is the whole system.</span>
          </p>
        </div>
      </div>
    );
  }

  // Desktop rail: expanded (w-60) or collapsed to icons (w-[68px]).
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-smooth lg:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-1 px-3",
          collapsed ? "justify-center px-2" : "justify-between",
        )}
      >
        <Brand collapsed={collapsed} />
        {!collapsed && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            aria-expanded={true}
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        ) : null}
      </div>

      <NavList collapsed={collapsed} />

      <div className={cn("border-t border-border p-3", collapsed && "px-2.5")}>
        {collapsed ? (
          onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              aria-expanded={false}
              className="mx-auto grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          ) : null
        ) : (
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
            Small, consistent steps.
            <br />
            <span className="font-medium text-fg">That is the whole system.</span>
          </p>
        )}
      </div>
    </aside>
  );
}
