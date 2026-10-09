import Link from "next/link";

// Empty state for a panel with nothing in it yet.
//
// Extracted from the Tasks page, which had the same markup inline. Optional
// `action` renders a button-sized link; `href` makes it navigate (used to point
// at /tasks) while `onClick` keeps the original callback style available.
export function EmptyState({
  title,
  hint,
  icon,
  href,
  actionLabel,
  onClick,
}: {
  title: string;
  hint?: string;
  /** Optional glyph rendered in the tinted square above the text. */
  icon?: React.ReactNode;
  /** When set, the action is a link to this route. */
  href?: string;
  actionLabel?: string;
  /** When set, the action is a button that calls this. */
  onClick?: () => void;
}) {
  const actionClass =
    "mt-4 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90";

  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      {icon ? (
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
          {icon}
        </div>
      ) : null}

      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}

      {href && actionLabel ? (
        <Link href={href} className={actionClass}>
          {actionLabel}
        </Link>
      ) : onClick && actionLabel ? (
        <button type="button" onClick={onClick} className={actionClass}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
