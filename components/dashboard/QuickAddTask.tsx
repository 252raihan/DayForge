"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { PlusIcon, ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { TaskInsert, TaskPriority } from "@/types";

// Quick task creation, inline at the top of the dashboard.
//
// Collapsed it is a single line ("Add a task…"); expanded it reveals the due
// date and priority. It calls the same `createTask` the Tasks page uses, so the
// row is a real Supabase insert and it appears on every page immediately.
//
// Due date is optional. When set, it is anchored at 09:00 local - the same
// convention the Calendar uses when adding a task to a day - then converted to
// a UTC instant, so it sorts correctly against tasks with a specific time.

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/** "YYYY-MM-DD" local -> UTC ISO, at 09:00 local. */
function dateToUtcIso(date: string): string | null {
  if (!date) return null;
  const local = new Date(`${date}T09:00`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

function todayInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function QuickAddTask({
  onCreate,
  defaultCategory,
  defaultPriority,
}: {
  onCreate: (values: TaskInsert) => Promise<unknown>;
  defaultCategory: string | null;
  defaultPriority: TaskPriority | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(defaultPriority ?? "medium");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    if (trimmed.length > 200) {
      setError("That title is too long (200 characters max).");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await onCreate({
        title: trimmed,
        description: null,
        due_at: dateToUtcIso(dueDate),
        priority,
        category: defaultCategory?.trim() || "Personal",
        recurrence_type: "none",
        recurrence_days: null,
        default_category: defaultCategory,
        default_priority: defaultPriority,
      });
      setTitle("");
      setDueDate("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the task.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-surface shadow-panel transition-colors focus-within:border-border-strong"
    >
      <div className="flex items-center gap-2 p-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <PlusIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <label htmlFor="quick-task-title" className="sr-only">
          New task title
        </label>
        <Input
          id="quick-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Add a task…"
          maxLength={200}
          className="h-8 border-transparent bg-transparent px-1 shadow-none hover:border-transparent focus:border-transparent focus:ring-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Hide task options" : "Show task options"}
          className="shrink-0 text-muted"
        >
          <ChevronDownIcon
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </Button>
        <Button
          type="submit"
          size="sm"
          loading={pending}
          loadingLabel="Adding"
          disabled={title.trim() === ""}
          className="shrink-0"
        >
          Add
        </Button>
      </div>

      {open ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-2.5 py-2">
          <label className="flex items-center gap-1.5 text-2xs font-medium text-muted">
            Due
            <Input
              type="date"
              value={dueDate}
              min={todayInputValue()}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
              className="h-7 w-auto py-0 text-xs"
            />
          </label>

          <div
            role="group"
            aria-label="Priority"
            className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
          >
            {PRIORITY_OPTIONS.map((option) => {
              const selected = priority === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPriority(option.value)}
                  className={cn(
                    "rounded-[6px] px-2 py-1 text-2xs font-medium transition-colors",
                    selected
                      ? "bg-surface text-fg shadow-xs ring-1 ring-border"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <p className="ml-auto text-2xs text-muted">
            Press Enter to save
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="px-2 pb-2">
          <Alert onDismiss={() => setError(null)}>{error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
