// A floating "dashboard preview" for the auth hero.
//
// Built from markup + inline SVG only: no screenshot, no image file and no
// extra dependency, so it stays crisp at any zoom and can never 404. It is
// decorative, so the whole block is aria-hidden - a screen reader hears the
// real hero copy, not a picture of a chart.

const WEEK_BARS = [46, 62, 54, 78, 70, 88, 96];

const TASKS = [
  { label: "Finish React module", meta: "Today", done: true },
  { label: "Review TypeScript notes", meta: "Today", done: true },
  { label: "Build portfolio page", meta: "Tomorrow", done: false },
];

export default function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      {/* Ambient glow behind the panel. */}
      <div className="animate-pulse-glow absolute -inset-6 rounded-[2rem] bg-brand-500/20 blur-3xl" />

      <div className="auth-glass animate-float relative rounded-3xl border border-white/10 p-4 shadow-card">
        {/* Window chrome */}
        <div className="mb-4 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
            This week
          </span>
          <span className="ml-auto rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            +24%
          </span>
        </div>

        {/* Two stat tiles */}
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Stat label="Tasks done" value="18" hint="of 22 this week" />
          <Stat label="Habit streak" value="12" hint="days in a row" />
        </div>

        {/* Weekly progress chart */}
        <div className="rounded-2xl border border-white/10 bg-navy-950/50 p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-400">Daily progress</span>
            <span className="text-[10px] font-semibold text-brand-300">82%</span>
          </div>
          <div className="flex h-16 items-end gap-1.5">
            {WEEK_BARS.map((height, index) => (
              <div key={index} className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[3px] bg-gradient-to-t from-brand-600/70 to-electric-400"
                  style={{ height: `${height}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Today's task list */}
        <div className="mt-3 space-y-1.5">
          {TASKS.map((task) => (
            <div
              key={task.label}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2"
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${task.done
                    ? "border-emerald-400/70 bg-emerald-400/20"
                    : "border-white/20 bg-transparent"
                  }`}
              >
                {task.done ? (
                  <svg
                    className="h-2.5 w-2.5 text-emerald-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </span>
              <span
                className={`truncate text-[11px] ${task.done ? "text-slate-400 line-through" : "text-slate-200"
                  }`}
              >
                {task.label}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-500">{task.meta}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-navy-950/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold leading-none text-white">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}
