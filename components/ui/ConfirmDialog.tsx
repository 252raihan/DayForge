"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/tasks/Modal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

// Standard destructive-confirmation dialog. It owns the pending/error state so
// each page does not have to repeat the same try/catch around a delete.

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  pendingLabel = "Deleting...",
  confirmVariant = "danger",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Rejecting keeps the dialog open and shows the error. */
  onConfirm: () => Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  confirmVariant?: "danger" | "warning";
  children?: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPending(false);
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
    >
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {children}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant={confirmVariant}
          onClick={handleConfirm}
          loading={pending}
          loadingLabel={pendingLabel}
          className="sm:w-40"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
