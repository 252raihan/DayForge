import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

// Form primitives shared by the app and the auth pages, so labels, hints,
// errors and controls look and behave identically everywhere.

type SharedFieldProps = {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  className?: string;
};

function FieldLabel({
  id,
  label,
  optional,
}: {
  id: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-fg">
      {label}
      {optional ? (
        <span className="ml-1 font-normal text-muted">(optional)</span>
      ) : null}
    </label>
  );
}

function FieldMessages({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string | null;
  hint?: string;
}) {
  if (error) {
    return (
      <p
        id={`${id}-error`}
        className="text-xs font-medium text-red-600 dark:text-red-400"
      >
        {error}
      </p>
    );
  }

  if (hint) {
    return (
      <p id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </p>
    );
  }

  return null;
}

function describedBy(id: string, error?: string | null, hint?: string) {
  return (
    [error ? `${id}-error` : null, !error && hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

type FieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "className"
> &
  SharedFieldProps & {
    value: string;
    onChange: (value: string) => void;
  };

// Label + input + hint/error, wired up for accessibility: `aria-invalid` and
// `aria-describedby` tie the message to the input so a screen reader announces
// it.
export function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  optional,
  className,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel id={id} label={label} optional={optional} />
      <Input
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

type SelectFieldProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "value" | "onChange" | "className"
> &
  SharedFieldProps & {
    value: string | number;
    onChange: (value: string) => void;
    children: React.ReactNode;
  };

export function SelectField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  optional,
  className,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel id={id} label={label} optional={optional} />
      <Select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      >
        {children}
      </Select>
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

type TextareaFieldProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "value" | "onChange" | "className"
> &
  SharedFieldProps & {
    value: string;
    onChange: (value: string) => void;
  };

export function TextareaField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  optional,
  className,
  ...props
}: TextareaFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel id={id} label={label} optional={optional} />
      <Textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

// Page-level message: an error or success alert.
export function FormMessage({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success";
}) {
  return <Alert tone={tone}>{children}</Alert>;
}

// Primary submit button with a built-in pending state.
export function SubmitButton({
  children,
  pending,
  pendingLabel = "Please wait...",
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  /** `default` = solid accent; `gradient` = the premium indigo->blue CTA. */
  tone?: "default" | "gradient";
  className?: string;
}) {
  return (
    <Button
      type="submit"
      fullWidth
      loading={pending}
      loadingLabel={pendingLabel}
      className={cn(
        tone === "gradient" &&
          "bg-gradient-to-r from-brand-500 via-brand-500 to-electric-500 shadow-glow hover:brightness-110 hover:shadow-[0_0_44px_-8px_rgba(116,104,255,0.7)] active:brightness-95",
        className,
      )}
    >
      {children}
    </Button>
  );
}
