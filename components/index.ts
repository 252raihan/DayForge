// Reusable presentational components live here.
// (e.g. buttons, cards, layout primitives.)
//
// Named re-exports, so a page can pull several primitives from one import:
//   import { PageHeader, Card, StatTile } from "@/components";

export { default as PageHeader } from "@/components/PageHeader";
export { default as Sidebar } from "@/components/Sidebar";
export { default as Topbar } from "@/components/Topbar";
export { default as ThemeToggle } from "@/components/ThemeToggle";
export { default as LogoutButton } from "@/components/LogoutButton";
export { Icon } from "@/components/icons";
export { default as Card } from "@/components/ui/Card";
export { default as StatTile } from "@/components/ui/StatTile";
export { EmptyState } from "@/components/ui/EmptyState";
export { ErrorBanner } from "@/components/ui/ErrorBanner";
export { LoadingRows } from "@/components/ui/LoadingRows";
