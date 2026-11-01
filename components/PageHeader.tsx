import { cn } from "@/lib/cn";

// Page heading used by every route under app/(app).
//
// `actions` keeps primary page actions aligned the same way on every screen,
// including the mobile wrap (full-bleed row of controls under the title).

export default function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="-mx-1 flex shrink-0 items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
