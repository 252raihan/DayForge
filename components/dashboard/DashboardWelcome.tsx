// Welcome header for the dashboard: greeting, supporting line, and a compact
// date card with a CSS-only mountain-sunrise illustration.
//
// Rendered on the server; the date is the server's render date, which is fine
// because the component remounts on every navigation to /dashboard.

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const MOTIVATION = [
  "Today is a fresh page — write something good on it.",
  "Small steps every day. Big results.",
  "Progress, not perfection. Keep going.",
  "One task at a time. You have got this.",
  "Show up today — future you will thank you.",
];

export function DashboardWelcome({ name }: { name: string }) {
  const now = new Date();
  const motivation = MOTIVATION[now.getDate() % MOTIVATION.length];

  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const day = now.toLocaleDateString(undefined, { day: "numeric" });
  const month = now.toLocaleDateString(undefined, { month: "short" });
  const year = now.getFullYear();

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card2/80 via-surface to-surface p-5 sm:p-7">
      {/* CSS-only mountain-sunrise: a glowing sun disc behind two peaks. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 max-w-sm" aria-hidden="true">
        <div className="absolute bottom-0 right-6 h-40 w-40 rounded-full bg-gradient-to-t from-electric-500/25 via-brand-500/20 to-transparent blur-2xl" />
        <div className="absolute bottom-8 right-12 h-16 w-16 rounded-full bg-gradient-to-br from-electric-400/70 to-brand-500/50 blur-[2px]" />
        <div className="absolute bottom-0 right-0 h-24 w-full [clip-path:polygon(0_100%,38%_18%,62%_62%,100%_100%)] bg-gradient-to-t from-navy-900/90 to-navy-800/40" />
        <div className="absolute bottom-0 right-0 h-16 w-full [clip-path:polygon(0_100%,55%_8%,100%_100%)] bg-gradient-to-t from-navy-950 to-navy-900/70" />
      </div>

      <div className="relative">
        <p className="text-sm font-medium text-muted">{greeting(now)},</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Hi, {name} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Your day at a glance: mark today&apos;s tasks Yes or No, and watch your
          daily completion chart fill up.
        </p>

        {/* Compact date card */}
        <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-border bg-app/70 px-4 py-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-electric-500/10 text-lg font-semibold text-brand-300">
            {day}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {weekday}, {month} {year}
            </p>
            <p className="truncate text-xs text-muted">{motivation}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
