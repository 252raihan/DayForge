// Single source of truth for the app's navigation.
// Sidebar and the mobile bottom nav both read from this list, so a new page
// only has to be registered once (plus its route file under app/).

export type NavItem = {
  href: string;
  label: string;
  /** Key into the icon map in components/icons.tsx */
  icon: IconName;
};

export type IconName =
  | "dashboard"
  | "tasks"
  | "calendar"
  | "notes"
  | "challenges"
  | "habits"
  | "settings";

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/notes", label: "Notes", icon: "notes" },
  { href: "/challenges", label: "Challenges", icon: "challenges" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
