import { cn } from "@/lib/cn";

// Inline alert for load failures, rejected mutations and success messages.
// `role="alert"` interrupts for errors; everything else is announced politely.

export type AlertTone = "error" | "warning" | "success" | "info";

const TONES: Record<AlertTone, string> = {
  error:
    "border-red-200 bg-red-50/80 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300",
  warning:
    "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  success:
    "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
  info: "border-accent/25 bg-accent-soft text-accent",
};

const ICONS: Record<AlertTone, React.ReactNode> = {
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
};

export function Alert({
  tone = "error",
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children: React.ReactNode;
  /** A retry or dismiss button rendered on the right. */
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed shadow-xs",
        TONES[tone],
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[tone]}
        </svg>
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          <div className={cn(title && "mt-0.5", "break-words")}>{children}</div>
        </div>
      </div>

      {action || onDismiss ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {action}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss message"
              className="rounded-lg p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
