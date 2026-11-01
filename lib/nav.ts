// Single source of truth for the app's navigation.
// Sidebar, mobile drawer and the mobile bottom nav all read from this list, so a
// new page only has to be registered once (plus its route file under app/).
//
// `group` drives the small section labels in the desktop rail.

export type NavItem = {
  href: string;
  label: string;
  /** Key into the icon map in components/icons.tsx */
  icon: IconName;
  /** Optional short description, used by the collapsed rail's tooltip. */
  hint?: string;
};

export type IconName =
  | "dashboard"
  | "tasks"
  | "calendar"
  | "notes"
  | "challenges"
  | "habits"
  | "settings";

export type NavGroup = "plan" | "grow" | "account";

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "grow", label: "Grow" },
  { key: "account", label: "Account" },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", hint: "Today at a glance" },
  { href: "/tasks", label: "Tasks", icon: "tasks", hint: "Everything to do" },
  { href: "/calendar", label: "Calendar", icon: "calendar", hint: "Your month and week" },
  { href: "/habits", label: "Habits", icon: "habits", hint: "Daily routines" },
  { href: "/challenges", label: "Challenges", icon: "challenges", hint: "Time-boxed goals" },
  { href: "/notes", label: "Notes", icon: "notes", hint: "What you have written" },
  { href: "/settings", label: "Settings", icon: "settings", hint: "Profile and preferences" },
];

/** Which section a route belongs to, for the grouped rail. */
export function navGroup(href: string): NavGroup {
  if (href === "/settings") return "account";
  if (href === "/habits" || href === "/challenges" || href === "/notes") return "grow";
  return "plan";
}
