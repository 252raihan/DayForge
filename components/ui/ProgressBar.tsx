import { cn } from "@/lib/cn";

// Shared progress bar. The percentage is clamped so a stale or over-complete
// value can never draw outside the track.

const TONES = {
  accent: "bg-accent",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  label,
  className,
  height = "h-1.5",
}: {
  value: number;
  max?: number;
  tone?: keyof typeof TONES;
  label: string;
  className?: string;
  height?: string;
}) {
  const percent =
    max <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className={cn(
        "w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border/60",
        height,
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-smooth", TONES[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// Donut for a single percentage (daily completion). Pure SVG arc, no library.
// The number sits in the middle and is also the accessible value.
export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  tone = "accent",
  label,
  children,
  className,
}: {
  /** 0-100, or null when there is nothing to show yet. */
  value: number | null;
  size?: number;
  stroke?: number;
  tone?: keyof typeof TONES;
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value));
  const dash = (pct / 100) * circumference;

  const strokeColor: Record<keyof typeof TONES, string> = {
    accent: "rgb(var(--accent))",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  };

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? 0}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
