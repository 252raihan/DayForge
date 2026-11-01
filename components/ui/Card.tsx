import { cn } from "@/lib/cn";

// Card: the standard surface used for every panel in the app.
//
// One place for the border, radius, background and padding, so panels cannot
// drift apart. The shadow is a two-part hairline-plus-ambient pair (see
// tailwind.config.ts) rather than a heavy drop shadow.
//
// `tone="inset"` renders the nested "row inside a card" surface; `flat` drops
// the shadow for panels that are already inside another container.

export default function Card({
  children,
  className,
  as: Tag = "section",
  tone = "default",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
  tone?: "default" | "inset" | "flat";
  /** Set false when the card manages its own internal padding. */
  padded?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-xl border text-fg",
        tone === "default" && "border-border bg-surface shadow-panel",
        tone === "inset" && "border-border bg-surface-2",
        tone === "flat" && "border-border bg-surface",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// Card heading with an optional description and an action slot on the right
// (e.g. a "View all" link). Kept here so every panel's header lines up.
export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Small leading glyph, rendered in a muted square. */
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-px grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-muted">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Quiet "view all" style link used in card headers and list footers. */
export { default as CardLink } from "@/components/ui/CardLink";
