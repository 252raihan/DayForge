// Small form primitives shared by the auth pages so the fields look and behave
// identically everywhere.

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  /** Validation or server error to show under the field. */
  error?: string | null;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
};

// Label + input + error message, wired up for accessibility:
// `aria-invalid` and `aria-describedby` tie the error text to the input so a
// screen reader announces it.
export function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  required,
  hint,
}: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:ring-2 focus:ring-accent/40 ${error ? "border-red-400 focus:border-red-500" : "border-border focus:border-accent"
          }`}
      />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Page-level message: a red error box or a green success box.
export function FormMessage({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success";
}) {
  const styles =
    tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300";

  // role=status is announced politely; role=alert interrupts for errors.
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

// Primary submit button with a built-in pending state.
export function SubmitButton({
  children,
  pending,
  pendingLabel = "Please wait...",
}: {
  children: React.ReactNode;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
