import Card from "@/components/ui/Card";

// A single headline number on the dashboard (due today, overdue, ...).
// `tone` switches the accent, and the value is always labelled in words - the
// colour alone is never the message.

type Tone = "default" | "danger" | "warning" | "success";

// `text-foreground` is not a token in this project - the default body colour is
// inherited, so the neutral tone leaves the value uncoloured.
const TONES: Record<Tone, { value: string; badge: string }> = {
  default: { value: "", badge: "bg-accent-soft text-accent" },
  danger: { value: "text-red-600 dark:text-red-400", badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  warning: { value: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  success: { value: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};

export default function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  /** A number, or a short string when the tile reads better as "3/5". */
  value: number | string;
  hint?: string;
  tone?: Tone;
}) {
  const styles = TONES[tone];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <span className={`grid h-6 min-w-6 place-items-center rounded-lg px-1.5 text-xs font-semibold ${styles.badge}`}>
          {value}
        </span>
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${styles.value}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
