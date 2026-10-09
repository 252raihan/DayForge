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
}: {
  /** The task to delete, or null when the dialog is closed. */
  task: Task | null;
  onClose: () => void;
  onConfirm: (task: Task) => Promise<void>;
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
      description="This can't be undone."
    >
      {error ? <div className="mb-4"><FormMessage>{error}</FormMessage></div> : null}

      {task ? (
        <p className="mb-5 rounded-xl border border-border bg-app px-3.5 py-2.5 text-sm">
          {task.title}
        </p>
      ) : null}

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
