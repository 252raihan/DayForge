import { cn } from "@/lib/cn";

// Shared button styles. Every button in the app should come from here so
// height, radius, focus, disabled and hover behaviour stay identical.
//
// Design notes:
//   - Radius is 8px (rounded-lg), not a pill, so actions read as tooling.
//   - The solid variants carry a 1px inner highlight (`shadow-xs`) and move one
//     step darker on hover instead of changing opacity (opacity washes out the
//     label over coloured backgrounds).
//   - Every variant keeps the same height per size, so a row of mixed buttons
//     lines up on the baseline.

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerSubtle"
  | "success"
  | "warning";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const BASE =
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 ease-smooth " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-accent text-white shadow-xs hover:bg-accent/90 active:bg-accent/80",
  secondary:
    "border-border bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-2 active:bg-surface-2",
  ghost:
    "border-transparent text-muted hover:bg-surface-2 hover:text-fg active:bg-surface-2",
  danger: "border-transparent bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800",
  dangerSubtle:
    "border-border bg-surface text-red-600 shadow-xs hover:border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:border-red-900 dark:hover:bg-red-950/40",
  success:
    "border-border bg-surface text-emerald-700 shadow-xs hover:border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/40",
  warning:
    "border-border bg-surface text-amber-700 shadow-xs hover:border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:hover:border-amber-900 dark:hover:bg-amber-950/40",
};

const ACTIVE_VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-white",
  secondary: "border-accent/40 bg-accent-soft text-accent",
  ghost: "border-transparent bg-accent-soft text-accent",
  danger: "border-transparent bg-red-600 text-white",
  dangerSubtle: "border-transparent bg-red-600 text-white",
  success: "border-transparent bg-emerald-600 text-white",
  warning: "border-transparent bg-amber-500 text-white",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-10 px-4 text-sm",
  icon: "h-9 w-9 p-0",
  "icon-sm": "h-7 w-7 p-0",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  active = false,
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    BASE,
    active ? ACTIVE_VARIANTS[variant] : VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  active = false,
  fullWidth = false,
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, active, fullWidth, className })}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
