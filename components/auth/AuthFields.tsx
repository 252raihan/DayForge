"use client";

// Inputs for the premium dark auth card.
//
// These are the dark-surface siblings of components/ui/Form.tsx: same
// accessibility contract (`aria-invalid`, `aria-describedby`, real <label>),
// different visual treatment. The icon is decorative and the input's padding
// leaves room for it, so the icon can never overlap typed text.

import { useState } from "react";
import type * as React from "react";
import { AuthIcon, type AuthIconName } from "@/components/auth/AuthIcons";

type BaseProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  icon: AuthIconName;
  /** Rendered on the right of the label row (e.g. "Forgot password?"). */
  labelAction?: React.ReactNode;
  /** Rendered inside the field on the right (e.g. show/hide password). */
  trailing?: React.ReactNode;
};

export function IconField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
  required,
  icon,
  labelAction,
  trailing,
  type = "text",
}: BaseProps & { type?: string }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-[13px] font-medium text-slate-300">
          {label}
        </label>
        {labelAction}
      </div>

      <div className="relative">
        <span
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${error ? "text-red-400/80" : "text-slate-500"
            }`}
        >
          <AuthIcon name={icon} className="h-[18px] w-[18px]" />
        </span>

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
            [error ? errorId : null, hint && !error ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={`auth-input ${trailing ? "pr-11" : ""}`}
        />

        {trailing ? (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>
        ) : null}
      </div>

      {hint && !error ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Password field with an accessible show/hide toggle. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
  required,
  labelAction,
}: Omit<BaseProps, "icon" | "trailing">) {
  const [visible, setVisible] = useState(false);

  return (
    <IconField
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      icon="lock"
      labelAction={labelAction}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? "Hide password" : "Show password"}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          <AuthIcon name={visible ? "eyeOff" : "eye"} className="h-[18px] w-[18px]" />
        </button>
      }
    />
  );
}

/** Page-level error/success box, dark variant. */
export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5" />
        <path d="M12 16.5h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
