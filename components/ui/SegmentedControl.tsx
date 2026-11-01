"use client";

import { cn } from "@/lib/cn";

// One row of mutually exclusive choices, used for tabs, view switches and
// compact toggles. Built on the tab pattern so arrow-key and screen-reader
// behaviour matches the visual affordance.
//
// Two shapes:
//   - default: segmented control on a hairline track (page-level tabs)
//   - "underline": borderless tabs with an accent underline (in-card sections)

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Optional count or short badge shown after the label. */
  badge?: React.ReactNode;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  fullWidth = false,
  variant = "segmented",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  fullWidth?: boolean;
  variant?: "segmented" | "underline";
}) {
  if (variant === "underline") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "scrollbar-thin flex gap-1 overflow-x-auto border-b border-border",
          fullWidth && "w-full",
          className,
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                selected
                  ? "border-accent text-fg"
                  : "border-transparent text-muted hover:border-border-strong hover:text-fg",
                fullWidth && "flex-1 justify-center",
              )}
            >
              {option.label}
              {option.badge != null ? option.badge : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "scrollbar-thin inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-border bg-surface-2 p-0.5",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
              fullWidth && "flex-1",
              selected
                ? "bg-surface text-fg shadow-xs ring-1 ring-border"
                : "text-muted hover:text-fg",
            )}
          >
            {option.label}
            {option.badge != null ? option.badge : null}
          </button>
        );
      })}
    </div>
  );
}
