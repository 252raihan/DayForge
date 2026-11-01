"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Field,
  SelectField,
  TextareaField,
} from "@/components/ui";
import { CloseIcon, PinIcon, TrashIcon } from "@/components/icons";
import {
  AUTOSAVE_DELAY_MS,
  draftFromNote,
  draftsEqual,
  parseTags,
  type NoteDraft,
} from "@/lib/note-utils";
import type { Note, Task } from "@/types";

export type { NoteDraft };

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
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface shadow-panel">
      {/* Header: save state, then the actions. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-2xs">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              saving
                ? "bg-amber-500 animate-pulse"
                : error
                  ? "bg-red-500"
                  : dirty
                    ? "bg-amber-500"
                    : "bg-emerald-500"
            }`}
            aria-hidden="true"
          />
          {saving ? (
            <span role="status" className="font-medium text-muted">
              Saving…
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
            <span className="text-muted">Saved{savedAt ? ` at ${savedAt}` : ""}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            active={draft.pinned}
            onClick={() => update("pinned", !draft.pinned)}
            aria-pressed={draft.pinned}
          >
            <PinIcon className="h-3.5 w-3.5" />
            {draft.pinned ? "Pinned" : "Pin"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveNow}
            disabled={saving || !dirty}
          >
            Save
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete this note"
            className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="lg:hidden"
            aria-label="Close editor"
          >
            <CloseIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-4 pt-3">
          <Alert onDismiss={() => setError(null)}>{error}</Alert>
        </div>
      ) : null}

      {confirmingDelete ? (
        <Alert
          tone="warning"
          title="Delete this note? This can't be undone."
          className="mx-4 mt-3"
        >
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={saving}
              loadingLabel="Deleting..."
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
            >
              Delete note
            </Button>
          </div>
        </Alert>
      ) : null}

      {/* Fields */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <Field
          id="note-title"
          label="Title"
          value={draft.title}
          onChange={(value) => update("title", value)}
          placeholder="Untitled note"
        />

        <TextareaField
          id="note-content"
          label="Note"
          value={draft.content}
          onChange={(value) => update("content", value)}
          rows={14}
          placeholder="Write your note here..."
          className="[&_textarea]:resize-y [&_textarea]:leading-relaxed"
          hint={`${
            draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0
          } words · saved automatically`}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="note-category"
            label="Course / subject"
            value={draft.category}
            onChange={(value) => update("category", value)}
            placeholder="e.g. Data Structures"
            list="note-category-suggestions"
          />

          <Field
            id="note-tags"
            label="Tags"
            value={tagInput}
            onChange={(value) => {
              setTagInput(value);
              update("tags", parseTags(value));
            }}
            placeholder="exam, revision"
            hint="Separate tags with commas."
          />
        </div>

        <datalist id="note-category-suggestions">
          {categorySuggestions.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <SelectField
          id="note-task"
          label="Linked task"
          optional
          value={draft.taskId ?? ""}
          onChange={(value) => update("taskId", value || null)}
        >
          <option value="">Not linked</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </SelectField>
      </div>

      {/* Save lives in the header as well ("Save now"); this is the larger
          target for people who reach the bottom of a long note. */}
      <div className="flex justify-end border-t border-border p-3">
        <Button
          onClick={handleSaveNow}
          loading={saving}
          loadingLabel="Saving..."
          disabled={!dirty}
          className="w-full sm:w-32"
        >
          {dirty ? "Save note" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
