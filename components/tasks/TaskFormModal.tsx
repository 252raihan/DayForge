"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/tasks/Modal";
import { Field, FormMessage, SubmitButton } from "@/components/ui/Form";
import { localInputToUtc, utcToLocalInput } from "@/hooks/useTasks";
import type { Task, TaskInsert, TaskPriority } from "@/types";

// Create / edit form shown in a modal.
// Passing a `task` switches the modal into edit mode.

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

// Suggested categories - the field is free text, so users can type their own.
const CATEGORY_SUGGESTIONS = ["Personal", "Assignment", "Exam", "Study", "Project"];

export default function TaskFormModal({
  open,
  onClose,
  onSubmit,
  task,
}: {
  open: boolean;
  onClose: () => void;
  /** Resolves once the row is saved; throws (with a friendly message) on error. */
  onSubmit: (values: TaskInsert) => Promise<void>;
  /** When present, the form edits this task instead of creating one. */
  task?: Task | null;
}) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Kept in `datetime-local` format (local time); converted to UTC on submit.
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [category, setCategory] = useState("Personal");

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Reset the fields whenever the modal opens, seeding from `task` in edit mode.
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDueAt(utcToLocalInput(task?.due_at ?? null));
    setPriority(task?.priority ?? "medium");
    setCategory(task?.category ?? "Personal");
    setErrors({});
    setFormError(null);
    setPending(false);
  }, [open, task]);

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
