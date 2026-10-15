"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/tasks/Modal";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { localInputToUtc, utcToLocalInput, WEEKDAY_LABELS } from "@/hooks/useTasks";
import type { RecurrenceType, Task, TaskInsert, TaskPriority } from "@/types";

// Create / edit form shown in a modal.
// Passing a `task` switches the modal into edit mode.

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

// The Repeat selector. "Custom days" reveals the weekday buttons below it.
const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom days" },
];

// Suggested categories - the field is free text, so users can type their own.
const CATEGORY_SUGGESTIONS = ["Personal", "Assignment", "Exam", "Study", "Project"];

export default function TaskFormModal({
  open,
  onClose,
  onSubmit,
  task,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  /** Resolves once the row is saved; throws (with a friendly message) on error. */
  onSubmit: (values: TaskInsert) => Promise<void>;
  /** When present, the form edits this task instead of creating one. */
  task?: Task | null;
  /**
   * Settings preferences, and an optional date to pre-fill.
   *
   * `onDate` is how the Calendar creates a task on the day the user clicked:
   * a "YYYY-MM-DD" date lands in the due-date field at 09:00 local time, which
   * is a real instant rather than a floating one, so it still sorts correctly
   * against tasks with a specific time.
   */
  defaults?: {
    category?: string | null;
    priority?: TaskPriority | null;
    onDate?: string | null;
  };
}) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Kept in `datetime-local` format (local time); converted to UTC on submit.
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [category, setCategory] = useState("Personal");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  // 0 = Sunday .. 6 = Saturday, matching the `recurrence_days` column.
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Reset the fields whenever the modal opens, seeding from `task` in edit mode.
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");

    // Edit mode wins; otherwise the Calendar's chosen day; otherwise empty.
    if (task) {
      setDueAt(utcToLocalInput(task.due_at));
    } else if (defaults?.onDate) {
      setDueAt(`${defaults.onDate}T09:00`);
    } else {
      setDueAt("");
    }

    setPriority(task?.priority ?? defaults?.priority ?? "medium");
    setCategory(task?.category ?? defaults?.category ?? "Personal");
    setRecurrenceType(task?.recurrence_type ?? "none");
    setRecurrenceDays(task?.recurrence_days ?? []);
    setErrors({});
    setFormError(null);
    setPending(false);
  }, [open, task, defaults?.onDate, defaults?.priority, defaults?.category]);

  /** Adds or removes a weekday from the custom-days selection. */
  function toggleDay(day: number) {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validate before calling the API.
    const next: typeof errors = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) next.title = "Give the task a title.";
    if (trimmedTitle.length > 200) next.title = "That title is too long (200 characters max).";
    if (description.length > 2000) next.description = "That description is too long (2000 characters max).";
    if (category.trim().length > 60) next.category = "That category is too long (60 characters max).";
    // "Custom days" needs at least one day, or there is no next occurrence to
    // schedule and the DB check constraint would reject the row anyway.
    if (recurrenceType === "custom" && recurrenceDays.length === 0) {
      next.recurrence = "Pick at least one day, or choose a different repeat option.";
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setPending(true);

    const values: TaskInsert = {
      title: trimmedTitle,
      description: description.trim() || null,
      // Local time -> UTC instant before it ever reaches the database.
      due_at: localInputToUtc(dueAt),
      priority,
      category: category.trim() || "Personal",
      recurrence_type: recurrenceType,
      // The column is NULL unless the type is "custom" - the check constraint
      // requires a 1-7 element array containing only values 0-6 otherwise.
      recurrence_days: recurrenceType === "custom" ? recurrenceDays : null,
      // Passed through so the hook can apply the user's saved defaults when the
      // field is still at its untouched default (see createTask in useTasks).
      default_category: defaults?.category ?? null,
      default_priority: defaults?.priority ?? null,
    };

    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit task" : "Add task"}
      description={
        isEdit ? "Update the details and save your changes." : "What do you need to get done?"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? <FormMessage>{formError}</FormMessage> : null}

        <Field
          id="title"
          label="Title"
          value={title}
          onChange={setTitle}
          error={errors.title}
          placeholder="e.g. Finish data structures assignment"
          required
        />

        {/* Textarea rather than the single-line Field component. */}
        <div className="space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Any details worth remembering..."
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "description-error" : undefined}
            className={`w-full resize-y rounded-xl border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:ring-2 focus:ring-accent/40 ${errors.description
                ? "border-red-400 focus:border-red-500"
                : "border-border focus:border-accent"
              }`}
          />
          {errors.description ? (
            <p id="description-error" className="text-xs font-medium text-red-600 dark:text-red-400">
              {errors.description}
            </p>
          ) : null}
        </div>

        {/* Due date + time. The value is local; converted to UTC on submit. */}
        <div className="space-y-1.5">
          <label htmlFor="dueAt" className="block text-sm font-medium">
            Due date and time <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
          <p className="text-xs text-muted">
            Shown in your local timezone.
            {dueAt ? (
              <button
                type="button"
                onClick={() => setDueAt("")}
                className="ml-1.5 font-medium text-accent hover:underline"
              >
                Clear
              </button>
            ) : null}
          </p>
        </div>

        {/* Priority: a radio group, since there are only three options. */}
        <fieldset className="space-y-1.5">
          <legend className="block text-sm font-medium">Priority</legend>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => {
              const selected = priority === p;
              return (
                <label
                  key={p}
                  className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-medium capitalize transition-colors ${selected
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-muted hover:bg-accent-soft/50"
                    }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={selected}
                    onChange={() => setPriority(p)}
                    className="sr-only"
                  />
                  {p}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Category: free text with suggestions. */}
        <div className="space-y-1.5">
          <label htmlFor="category" className="block text-sm font-medium">
            Category
          </label>
          <input
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="category-suggestions"
            placeholder="Personal"
            aria-invalid={errors.category ? true : undefined}
            className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:ring-2 focus:ring-accent/40 ${errors.category
                ? "border-red-400 focus:border-red-500"
                : "border-border focus:border-accent"
              }`}
          />
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {errors.category ? (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {errors.category}
            </p>
          ) : null}
        </div>

        {/* Repeat: None / Daily / Weekly / Custom days. */}
        <div className="space-y-1.5">
          <label htmlFor="recurrence" className="block text-sm font-medium">
            Repeat
          </label>
          <select
            id="recurrence"
            name="recurrence"
            value={recurrenceType}
            onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          >
            {RECURRENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Weekday picker, only relevant to "Custom days". */}
          {recurrenceType === "custom" ? (
            <fieldset className="pt-1">
              <legend className="mb-1.5 text-xs text-muted">Repeat on</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => {
                  const selected = recurrenceDays.includes(day);
                  return (
                    <label
                      key={label}
                      className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${selected
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border text-muted hover:bg-accent-soft/50"
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        onChange={() => toggleDay(day)}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
              {errors.recurrence ? (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {errors.recurrence}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {/* A repeating task needs a due date to anchor the next occurrence. */}
          {recurrenceType !== "none" && !dueAt ? (
            <p className="text-xs text-muted">
              Add a due date above so the next occurrence can be scheduled.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-60"
          >
            Cancel
          </button>
          <div className="sm:w-40">
            <SubmitButton pending={pending} pendingLabel="Saving...">
              {isEdit ? "Save changes" : "Add task"}
            </SubmitButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
