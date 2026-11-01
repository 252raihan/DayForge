import { forwardRef } from "react";
import { cn } from "@/lib/cn";

// Form controls. The styles are exported as constants so a one-off control
// (search with an icon, for example) can match the standard fields exactly.
//
// Focus is a two-layer cue: the border turns accent and a soft ring appears.
// `border-strong` is deliberately a step darker than the card hairline so an
// empty input is still findable on a white card.

export const controlBase =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13px] text-fg shadow-xs outline-none " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70 " +
  "hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70";

const invalidBase =
  "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

/** `ref` is forwarded so a search field can be focused from a key shortcut. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, invalid && invalidBase, className)}
      {...props}
    />
  );
});

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        // Native arrow replaced by a data-URI chevron so the control matches the
        // rest of the system on every platform.
        "cursor-pointer appearance-none bg-[length:16px_16px] bg-[right_0.625rem_center] bg-no-repeat pr-8",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236B7280%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
        invalid && invalidBase,
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-20 resize-y leading-relaxed", invalid && invalidBase, className)}
      {...props}
    />
  );
}

// Consistent checkbox. `accent-[...]` uses the theme accent without an extra
// wrapper class at every call site.
export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong accent-[rgb(var(--accent))] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
