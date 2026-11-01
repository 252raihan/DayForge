import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Empty state for a panel or page with nothing in it yet.
//
// Anatomy: a soft "well" (concentric ring + glyph), a short title, one line of
// guidance and a single action. No illustration assets, no emoji, no confetti -
// the point is to explain what belongs here and offer exactly one next step.
//
// Optional `action` renders a button-sized link; `href` makes it navigate while
// `onClick` keeps the callback style for local actions such as opening a modal.

export function EmptyState({
  title,
  hint,
  icon,
  href,
  actionLabel,
  onClick,
  className,
  size = "md",
}: {
  title: string;
  hint?: string;
  /** Optional glyph rendered inside the well. */
  icon?: React.ReactNode;
  /** When set, the action is a link to this route. */
  href?: string;
  actionLabel?: string;
  /** When set, the action is a button that calls this. */
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-surface text-center",
        size === "sm" ? "px-5 py-8" : "px-6 py-12 sm:py-14",
        className,
      )}
    >
      {/* Concentric rings give the glyph a deliberate, illustrated feel without
          shipping an image. */}
      <div className="relative mb-4 grid h-14 w-14 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-border bg-surface-2" />
        <span className="absolute inset-2 rounded-full border border-border/70" />
        {icon ? (
          <span className="relative text-muted">{icon}</span>
        ) : (
          <span className="relative text-muted">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 13h3.5l1.4 2.6h6.2L16.5 13H20" />
              <path d="M5.4 5.6h13.2L20 13v4.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.2V13z" />
            </svg>
          </span>
        )}
      </div>

      <p className="text-sm font-semibold tracking-tight text-fg">{title}</p>
      {hint ? (
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{hint}</p>
      ) : null}

      {href && actionLabel ? (
        <Link
          href={href}
          className={buttonStyles({ variant: "secondary", size: "md", className: "mt-5" })}
        >
          {actionLabel}
        </Link>
      ) : onClick && actionLabel ? (
        <Button variant="secondary" onClick={onClick} className="mt-5">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
