"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/tasks/Modal";
import { FormMessage } from "@/components/ui/Form";
import type { Task } from "@/types";

// Confirmation dialog shown before a task is deleted.
// Destructive actions are irreversible here, so this deliberately blocks the
// action behind an explicit choice.
export default function ConfirmDeleteModal({
  task,
  onClose,
  onConfirm,
  consequences,
}: {
  /** The task to delete, or null when the dialog is closed. */
  task: Task | null;
  onClose: () => void;
  onConfirm: (task: Task) => Promise<void>;
  /**
   * Related rows that will disappear with the task (its checklist, its daily
   * history). Both relationships cascade in the database, so this is stated up
   * front rather than discovered afterwards.
   */
  consequences?: string[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear state each time the dialog is reopened for a different task.
  useEffect(() => {
    if (task) {
      setPending(false);
      setError(null);
    }
  }, [task]);

  async function handleConfirm() {
    if (!task) return;
    setPending(true);
    setError(null);

    try {
      await onConfirm(task);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete the task. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <Modal
      open={Boolean(task)}
      onClose={onClose}
      title="Delete this task?"
      description="This task, its checklist and its daily history will be removed. This can't be undone."
    >
      {error ? <div className="mb-4"><FormMessage>{error}</FormMessage></div> : null}

      {task ? (
        <p className="rounded-xl border border-border bg-app px-3.5 py-2.5 text-sm">
          {task.title}
        </p>
      ) : null}

      {consequences && consequences.length > 0 ? (
        <div className="mb-5 mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          <p className="font-semibold">Also removed with this task:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {consequences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mb-5" />
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-40"
        >
          {pending ? "Deleting..." : "Delete task"}
        </button>
      </div>
    </Modal>
  );
}
