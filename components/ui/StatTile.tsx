import { cn } from "@/lib/cn";

// A single headline number on the dashboard, habits and challenges pages.
//
// `tone` switches only the value colour and the icon tint - never the card
// fill - so a row of four tiles stays calm while the numbers still carry
// meaning. The label is always in words, so colour is never the only signal.

type Tone = "default" | "danger" | "warning" | "success" | "info";

const TONES: Record<Tone, { value: string; icon: string }> = {
  default: {
    value: "text-fg",
    icon: "border-border bg-surface-2 text-muted",
  },
  danger: {
    value: "text-red-600 dark:text-red-400",
    icon: "border-red-200/70 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400",
  },
  warning: {
    value: "text-amber-600 dark:text-amber-400",
    icon: "border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-400",
  },
  success: {
    value: "text-emerald-600 dark:text-emerald-400",
    icon: "border-emerald-200/70 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-400",
  },
  info: {
    value: "text-blue-600 dark:text-blue-400",
    icon: "border-blue-200/70 bg-blue-50 text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-400",
  },
};

export default function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon,
  href,
  className,
}: {
  label: string;
  /** A number, or a short string when the tile reads better as "3/5". */
  value: number | string;
  hint?: string;
  tone?: Tone;
  /** Optional glyph shown in the tinted square on the right. */
  icon?: React.ReactNode;
  /** Optional: makes the whole tile a link (used for the dashboard counters). */
  href?: string;
  className?: string;
}) {
  const styles = TONES[tone];

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted">{label}</p>
        <p
          className={cn(
            "mt-1.5 text-2xl font-semibold leading-none tracking-tight tabular-nums",
            styles.value,
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1.5 truncate text-[11px] text-muted">{hint}</p> : null}
      </div>

      {icon ? (
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
            styles.icon,
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
    </div>
  );

  const shell =
    "rounded-xl border border-border bg-surface p-4 shadow-panel transition-colors";

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          shell,
          "block hover:border-border-strong hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          className,
        )}
      >
        {body}
      </a>
    );
  }

  return <div className={cn(shell, className)}>{body}</div>;
}
