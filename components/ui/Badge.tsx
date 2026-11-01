import { cn } from "@/lib/cn";

// Small status pill used for priorities, challenge states, tags and counts.
// The label is always present, so colour is never the only signal.
//
// Tones are *tinted*, not saturated: a very light fill with a matching 1px
// border and a darker text colour. That keeps a list of badges calm while still
// letting "High" or "Overdue" read at a glance.

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-2 text-muted",
  accent: "border-accent/20 bg-accent-soft text-accent",
  success:
    "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300",
  warning:
    "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300",
  danger:
    "border-red-200/70 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300",
  info: "border-blue-200/70 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300",
};

const DOT_TONES: Record<BadgeTone, string> = {
  neutral: "bg-[rgb(var(--muted))]",
  accent: "bg-accent",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
};

export function Badge({
  tone = "neutral",
  size = "sm",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  size?: "sm" | "md";
  /** Adds a status dot before the label. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-medium tabular-nums",
        size === "sm" ? "px-1.5 py-px text-[11px] leading-4" : "px-2 py-0.5 text-xs",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONES[tone])}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
