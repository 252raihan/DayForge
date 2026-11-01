// Greeting header for the dashboard.
//
// Server-rendered: the date and the greeting are resolved at request time, and
// the page is force-dynamic, so they are always current. The line under the
// title is a quiet insight rather than a motivational banner - it states what
// the data says ("4 of 6 answered", "first clear day this week") and nothing
// more, so it stays honest when the user has not done much yet.

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const PHRASES = [
  "A clear plan beats a long list.",
  "Small, steady progress compounds.",
  "One thing at a time is enough.",
  "Finish what matters most, then stop.",
  "Momentum comes from starting.",
];

export function DashboardWelcome({
  name,
  /** Today's completion (0-100) or null when nothing is answered yet. */
  percent,
  answered,
  total,
}: {
  name: string;
  percent: number | null;
  answered: number;
  total: number;
}) {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const day = now.toLocaleDateString(undefined, { day: "numeric" });
  const month = now.toLocaleDateString(undefined, { month: "long" });
  const year = now.getFullYear();

  // A single insight line, chosen from what is actually true right now.
  let insight: string;
  if (total === 0) {
    insight = "Nothing scheduled for today — a good day to get ahead.";
  } else if (percent === 100) {
    insight = `All ${total} tasks answered today. That is a clean sweep.`;
  } else if (answered === 0) {
    insight = `${total} task${total === 1 ? "" : "s"} scheduled. Mark the first one to start the day.`;
  } else {
    insight = `${answered} of ${total} answered — ${total - answered
      } left to mark today.`;
  }

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-muted">
          {greeting(now)}, {name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
          Here&apos;s your day
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
          {insight}{" "}
          <span className="hidden text-muted/80 sm:inline">
            {PHRASES[now.getDate() % PHRASES.length]}
          </span>
        </p>
      </div>

      {/* Date chip: a calendar page, not a hero illustration. */}
      <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-panel">
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
            {now.toLocaleDateString(undefined, { month: "short" })}
          </span>
          <span className="-mt-0.5 text-base font-semibold leading-none text-fg">
            {day}
          </span>
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-fg">
            {weekday}, {month} {year}
          </p>
          <p className="text-2xs text-muted">
            {total === 0
              ? "No tasks due"
              : percent === null
                ? "Not started yet"
                : `${percent}% complete today`}
          </p>
        </div>
      </div>
    </header>
  );
}
