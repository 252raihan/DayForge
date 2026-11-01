"use client";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Alert } from "@/components/ui/Alert";
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
  return (
    <ConfirmDialog
      open={Boolean(task)}
      onClose={onClose}
      onConfirm={() => (task ? onConfirm(task) : Promise.resolve())}
      title="Delete this task?"
      description="This task, its checklist and its daily history will be removed. This can't be undone."
      confirmLabel="Delete task"
      pendingLabel="Deleting..."
    >
      {task ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg">
          {task.title}
        </p>
      ) : null}

      {consequences && consequences.length > 0 ? (
        <Alert tone="warning" title="Also removed with this task" className="mt-3">
          <ul className="list-inside list-disc space-y-0.5">
            {consequences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </ConfirmDialog>
  );
}
