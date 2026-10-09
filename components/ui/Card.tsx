// Card: the standard surface used for every panel in the app.
// One place for the border, radius and background, so panels cannot drift.

export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

// Card heading with an optional action slot on the right (e.g. a "View all"
// link). Kept here so every panel's header lines up the same way.
export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
