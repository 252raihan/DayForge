"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/ui/Form";
import type { Note, Task } from "@/types";

// The note editor: title, body, course/category, tags and an optional link to
// one task, with debounced autosave.
//
// Autosave design, and why:
//   - Saves are debounced 800ms after the last keystroke, so typing does not
//     produce one request per character.
//   - Every save is guarded by a promise chain, so two saves can never overlap.
//     Without that, a slow early save could land after a fast later one and
//     quietly revert the user's text.
//   - A save that fails leaves the draft dirty and shows the error; it never
//     reports success it did not get.
//   - The newest editor state is mirrored into a ref so the unmount handler and
//     the beforeunload guard read the current draft rather than a stale closure.

/** How long to wait after the last edit before saving. */
const AUTOSAVE_DELAY_MS = 800;

export type NoteDraft = {
  title: string;
  content: string;
  category: string;
  tags: string[];
  pinned: boolean;
  taskId: string | null;
};

export function draftFromNote(note: Note): NoteDraft {
  return {
    title: note.title,
    content: note.content,
    category: note.category ?? "",
    tags: note.tags ?? [],
    pinned: note.pinned,
    taskId: note.task_id,
  };
}

/** True when two drafts hold the same content (tag order included). */
export function draftsEqual(a: NoteDraft, b: NoteDraft): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.category === b.category &&
    a.pinned === b.pinned &&
    a.taskId === b.taskId &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  );
}

/** Turns a comma-separated tag input into the array the database expects. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase().replace(/^#/, "");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

export default function NoteEditor({
  note,
  tasks,
  onSave,
  onDelete,
  onClose,
}: {
  /** The note being edited. */
  note: Note;
  /** The user's tasks, for the optional "linked task" picker. */
  tasks: Task[];
  /** Persists the draft. Rejects on failure so the editor can surface it. */
  onSave: (note: Note, draft: NoteDraft) => Promise<void>;
  onDelete: (note: Note) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<NoteDraft>(() => draftFromNote(note));
  const [saved, setSaved] = useState<NoteDraft>(() => draftFromNote(note));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [tagInput, setTagInput] = useState(() => (note.tags ?? []).join(", "));

  // The live draft and a serialising chain for the writes.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  // Re-seed when a different note is opened.
  useEffect(() => {
    const next = draftFromNote(note);
    setDraft(next);
    setSaved(next);
    setTagInput((note.tags ?? []).join(", "));
    setError(null);
    setSavedAt(null);
    setConfirmingDelete(false);
  }, [note]);

  const dirty = !draftsEqual(draft, saved);

  // Distinct categories already in use, offered as datalist suggestions so the
  // same course name is spelled the same way across notes.
  const categorySuggestions = Array.from(
    new Set(tasks.map((task) => task.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  // `dirty` in a ref too, so the unload listener does not need re-binding.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const persist = useCallback(
    async (next: NoteDraft) => {
      setSaving(true);
      setError(null);
      try {
        await onSave(note, next);
        setSaved(next);
        setSavedAt(new Date().toLocaleTimeString());
      } catch (err) {
        // The draft stays dirty, so the next edit (or Save now) retries.
        setError(
          err instanceof Error ? err.message : "Could not save this note. Please try again.",
        );
      } finally {
        setSaving(false);
      }
    },
    [note, onSave],
  );

  // Debounced autosave.
  useEffect(() => {
    if (!dirty) return;

    const timer = setTimeout(() => {
      // Chained rather than fired: it guarantees the previous write finished
      // before the next one starts, so an older payload cannot win a race.
      saveChain.current = saveChain.current.then(() => persist(draftRef.current));
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft, dirty, persist]);

  // Warn before a reload or tab close that would lose unsaved text. In-app
  // navigation does not fire this, so the unmount effect below handles it.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Save on unmount (switching notes or closing the editor), so navigating away
  // never drops the last few characters.
  useEffect(() => {
    return () => {
      if (!dirtyRef.current) return;
      const last = draftRef.current;
      void saveChain.current
        .then(() => onSaveRef.current(noteRef.current, last))
        .catch(() => {
          // Best effort: a failed final save leaves the row as the server last
          // had it, which the next open will show honestly.
        });
    };
  }, []);

  // Kept in refs so the unmount effect above has no dependency on changing
  // identities (a dependency there would re-run the effect and cancel its
  // cleanup on every render, which is exactly when the save is needed).
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const noteRef = useRef(note);
  noteRef.current = note;

  function update<K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveNow() {
    await persist(draftRef.current);
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-surface">
      {/* Header: state, then the actions. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
          {saving ? (
            <span role="status" className="font-medium">
              Saving...
            </span>
          ) : error ? (
            <span role="alert" className="font-medium text-red-600 dark:text-red-400">
              Not saved
            </span>
          ) : dirty ? (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400">
              Saved{savedAt ? ` at ${savedAt}` : ""}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => update("pinned", !draft.pinned)}
            aria-pressed={draft.pinned}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              draft.pinned
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted hover:bg-accent-soft/60 hover:text-accent"
            }`}
          >
            {draft.pinned ? "Pinned" : "Pin"}
          </button>

          <button
            type="button"
            onClick={handleSaveNow}
            disabled={saving || !dirty}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save now
          </button>

          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-accent lg:hidden"
            aria-label="Close editor"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-4 pt-3">
          <FormMessage>{error}</FormMessage>
        </div>
      ) : null}

      {confirmingDelete ? (
        <div className="mx-4 mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950/40">
          <p className="font-medium text-red-800 dark:text-red-300">
            Delete this note? This can&apos;t be undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                try {
                  await onDelete(note);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Could not delete the note.",
                  );
                  setConfirmingDelete(false);
                }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Delete note
            </button>
          </div>
        </div>
      ) : null}

      {/* Fields */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <label htmlFor="note-title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="note-title"
            value={draft.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Untitled note"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="note-content" className="block text-sm font-medium">
            Note
          </label>
          <textarea
            id="note-content"
            value={draft.content}
            onChange={(e) => update("content", e.target.value)}
            rows={14}
            placeholder="Write your note here..."
            className="w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
          <p className="text-xs text-muted">
            {draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0} words ·
            saved automatically
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="note-category" className="block text-sm font-medium">
              Course / subject
            </label>
            <input
              id="note-category"
              value={draft.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Data Structures"
              list="note-category-suggestions"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
            <datalist id="note-category-suggestions">
              {categorySuggestions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="note-tags" className="block text-sm font-medium">
              Tags
            </label>
            <input
              id="note-tags"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                update("tags", parseTags(e.target.value));
              }}
              placeholder="exam, revision"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
            <p className="text-xs text-muted">Separate tags with commas.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="note-task" className="block text-sm font-medium">
            Linked task <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            id="note-task"
            value={draft.taskId ?? ""}
            onChange={(e) => update("taskId", e.target.value || null)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          >
            <option value="">Not linked</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save lives in the header as well ("Save now"); this is the larger
          target for people who reach the bottom of a long note. */}
      <div className="flex justify-end border-t border-border p-4">
        <button
          type="button"
          onClick={handleSaveNow}
          disabled={saving || !dirty}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-40"
        >
          {saving ? "Saving..." : dirty ? "Save" : "Saved"}
        </button>
      </div>
    </div>
  );
}
