import { cn } from "@/lib/cn";

// A single selectable chip. Used for priorities, frequencies and weekday
// pickers where a radio group would be heavier than the UI needs.

export function ChoiceChip({
  selected,
  onClick,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-[13px] font-medium shadow-xs transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        selected
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}
