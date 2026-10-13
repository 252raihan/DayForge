"use client";

import { useState } from "react";
import SubTaskProgress from "@/components/tasks/SubTaskProgress";
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
    <div className="mt-3 border-t border-border/70 pt-3">
      {/* Header: the toggle, plus the progress readout. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 text-left text-[11px] font-semibold text-muted transition-colors hover:text-accent"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {total > 0 ? "Subtasks" : "Add subtasks"}
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
                    className={`group/sub flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-app ${busy ? "opacity-60" : ""
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      disabled={busy}
                      onChange={() => void run(subtask.id, () => onToggle(subtask))}
                      aria-label={
                        subtask.done
                          ? `Mark "${subtask.title}" as not done`
                          : `Mark "${subtask.title}" as done`
                      }
                      className="shrink-0 cursor-pointer rounded border-border accent-[rgb(var(--accent))]"
                      style={{ height: "0.9rem", width: "0.9rem" }}
                    />

                    <span
                      className={`min-w-0 flex-1 break-words text-xs ${subtask.done ? "text-muted line-through" : ""
                        }`}
                    >
                      {subtask.title}
                    </span>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(subtask.id, () => onDelete(subtask.id))}
                      aria-label={`Delete subtask "${subtask.title}"`}
                      className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover/sub:opacity-100 disabled:opacity-50"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Add a subtask. A form so Enter submits, matching the rest of the app. */}
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a subtask..."
              maxLength={200}
              disabled={pending}
              aria-label="New subtask title"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || draft.trim() === ""}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Adding..." : "Add"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}