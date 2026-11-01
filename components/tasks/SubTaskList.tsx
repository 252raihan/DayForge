"use client";

import { useState } from "react";
import SubTaskProgress from "@/components/tasks/SubTaskProgress";
import { Button, Checkbox, Input } from "@/components/ui";
import { ChevronRightIcon, CloseIcon } from "@/components/icons";
import type { SubTask } from "@/types";

// The checklist attached to one task card.
//
// Collapsed by default so a long list stays scannable, and it expands
// automatically when the task already has subtasks. Everything here is
// local UI state plus callbacks; the Supabase calls live in useTasks.
//
// States covered:
//   - loading  : a spinner row while the first fetch is in flight
//   - error    : the row-level message from a failed mutation
//   - empty    : the "no subtasks yet" hint under the input
//   - populated: the checklist itself

export default function SubTaskList({
  subtasks,
  loading,
  onAdd,
  onToggle,
  onDelete,
}: {
  /** This task's checklist, oldest first. */
  subtasks: SubTask[];
  /** True while the first load is still running. */
  loading: boolean;
  onAdd: (title: string) => Promise<void>;
  onToggle: (subtask: SubTask) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ids mid-mutation, so their own controls disable without freezing the list.
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const done = subtasks.filter((s) => s.done).length;
  const total = subtasks.length;

  // The panel opens itself once a checklist exists, and stays open once the
  // user has opened it (so deleting the last item does not snap it shut).
  const expanded = open || total > 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title || pending) return;

    setPending(true);
    setError(null);
    try {
      await onAdd(title);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the subtask.");
    } finally {
      setPending(false);
    }
  }

  async function run(id: string, action: () => Promise<void>) {
    setBusyIds((prev) => [...prev, id]);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the subtask.");
    } finally {
      setBusyIds((prev) => prev.filter((x) => x !== id));
    }
  }

  return (
    <div className="mt-3 border-t border-border/70 pt-2.5">
      {/* Header: the toggle, plus the progress readout. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 rounded-md py-0.5 text-left text-2xs font-medium text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ChevronRightIcon
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        {total > 0 ? `Subtasks · ${done}/${total} done` : "Add subtasks"}
      </button>

      {/* Progress bar with its "2/5 done" label. */}
      <SubTaskProgress done={done} total={total} />

      {expanded ? (
        <div className="mt-2.5 space-y-2">
          {error ? (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          {/* Loading state for the very first fetch. */}
          {loading && total === 0 ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent"
                aria-hidden="true"
              />
              Loading subtasks...
            </p>
          ) : null}

          {/* Empty state. */}
          {!loading && total === 0 ? (
            <p className="text-xs text-muted">
              No subtasks yet. Break the task into steps below.
            </p>
          ) : null}

          {total > 0 ? (
            <ul className="space-y-1">
              {subtasks.map((subtask) => {
                const busy = busyIds.includes(subtask.id);
                return (
                  <li
                    key={subtask.id}
                    className={`group/sub flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2 ${
                      busy ? "opacity-60" : ""
                    }`}
                  >
                    <Checkbox
                      checked={subtask.done}
                      disabled={busy}
                      onChange={() => void run(subtask.id, () => onToggle(subtask))}
                      aria-label={
                        subtask.done
                          ? `Mark "${subtask.title}" as not done`
                          : `Mark "${subtask.title}" as done`
                      }
                      className="h-3.5 w-3.5"
                    />

                    <span
                      className={`min-w-0 flex-1 break-words text-xs ${
                        subtask.done ? "text-muted line-through" : "text-fg"
                      }`}
                    >
                      {subtask.title}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() => void run(subtask.id, () => onDelete(subtask.id))}
                      aria-label={`Delete subtask "${subtask.title}"`}
                      className="h-6 w-6 shrink-0 text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover/sub:opacity-100 disabled:opacity-50 dark:hover:bg-red-950/50"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Add a subtask. A form so Enter submits, matching the rest of the app. */}
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <Input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a subtask..."
              maxLength={200}
              disabled={pending}
              aria-label="New subtask title"
              className="h-7 min-w-0 flex-1 px-2.5 py-0 text-xs"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={pending || draft.trim() === ""}
              loading={pending}
              loadingLabel="Adding..."
            >
              Add
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
