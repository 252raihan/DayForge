import Link from "next/link";

// Shared frame for every auth screen: centred card, brand, and a footer link
// to the opposite screen. Keeps /login, /signup and friends consistent.
export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-sm font-bold text-white">
            D
          </span>
          <span className="text-xl font-semibold tracking-tight">DayForge</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-7">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>

          {children}
        </div>

        {footer ? (
          <div className="mt-5 text-center text-sm text-muted">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
