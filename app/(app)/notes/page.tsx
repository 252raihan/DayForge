"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { EmptyState, ErrorBanner, LoadingRows } from "@/components/ui";
import NoteEditor, { type NoteDraft } from "@/components/notes/NoteEditor";
import { ALL_TAGS, useNotes } from "@/hooks/useNotes";
import { useTasks } from "@/hooks/useTasks";
import { HOME_SCOPE } from "@/lib/home-scope";
import type { Note, NoteSort, Task } from "@/types";

// Notes: a list on the left, the editor on the right (stacked on mobile).
//
// The list is searchable and sortable, and the editor autosaves - see
// components/notes/NoteEditor.tsx for how saves are sequenced and how an
// unsaved draft is protected on navigation and reload.
//
// The task list is loaded here purely to fill the optional "linked task"
// picker and the category suggestions; the same hook the Tasks page uses, so
// no extra data or permissions are involved.
export default function NotesPage() {
  const {
    visibleNotes,
    selected,
    selectNote,
    tags,
    loading,
    error,
    reload,
    search,
    setSearch,
    tag,
    setTag,
    pinnedOnly,
    setPinnedOnly,
    sort,
    setSort,
    hasActiveRefinements,
    clearRefinements,
    createNote,
    updateNote,
    deleteNote,
  } = useNotes();

  const { accountTasks } = useTasks(HOME_SCOPE);

  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of accountTasks) map.set(task.id, task);
    return map;
  }, [accountTasks]);

  async function handleCreate() {
    setCreating(true);
    setActionError(null);
    try {
      const note = await createNote({ title: "", content: "" });
      selectNote(note.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not create the note.");
    } finally {
      setCreating(false);
    }
  }

  /** Persists an editor draft. Throws, so a failure keeps the draft dirty. */
  async function handleSave(note: Note, draft: NoteDraft) {
    await updateNote(note.id, {
      title: draft.title,
      content: draft.content,
      category: draft.category.trim() || null,
      tags: draft.tags,
      pinned: draft.pinned,
      task_id: draft.taskId,
    });
  }

  async function handleDelete(note: Note) {
    await deleteNote(note.id);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Notes"
          description="Lecture notes, quick thoughts and revision material. Changes save as you type."
        />

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {creating ? "Creating..." : "New note"}
        </button>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <ErrorBanner message={actionError} />
        </div>
      ) : null}

      {/* Toolbar: search, tag filter, sort and the pinned toggle. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="notes-search" className="sr-only">
            Search notes
          </label>
          <input
            id="notes-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <div>
          <label htmlFor="notes-tag" className="sr-only">
            Filter by tag
          </label>
          <select
            id="notes-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          >
            <option value={ALL_TAGS}>All tags</option>
            {tags.map((value) => (
              <option key={value} value={value}>
                #{value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="notes-sort" className="sr-only">
            Sort notes
          </label>
          <select
            id="notes-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as NoteSort)}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40"
          >
            <option value="updated">Last updated</option>
            <option value="created">Date created</option>
            <option value="title">Title</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setPinnedOnly((prev) => !prev)}
          aria-pressed={pinnedOnly}
          className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            pinnedOnly
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-muted hover:bg-accent-soft/60 hover:text-accent"
          }`}
        >
          Pinned only
        </button>

        {hasActiveRefinements ? (
          <button
            type="button"
            onClick={clearRefinements}
            className="rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
        {/* List */}
        <section className="min-w-0">
          {loading ? (
            <LoadingRows count={3} label="Loading notes" />
          ) : visibleNotes.length === 0 ? (
            <EmptyState
              title={hasActiveRefinements ? "No matching notes" : "No notes yet"}
              hint={
                hasActiveRefinements
                  ? "Try a different search term, tag or filter."
                  : "Create your first note to keep lecture material in one place."
              }
              actionLabel={hasActiveRefinements ? "Clear filters" : "New note"}
              onClick={hasActiveRefinements ? clearRefinements : handleCreate}
            />
          ) : (
            <ul className="space-y-2">
              {visibleNotes.map((note) => {
                const isActive = selected?.id === note.id;
                const linkedTask = note.task_id ? tasksById.get(note.task_id) : undefined;
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => selectNote(note.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        isActive
                          ? "border-accent bg-accent-soft"
                          : "border-border bg-surface hover:border-accent/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium">
                          {note.title.trim() || "Untitled note"}
                        </p>
                        {note.pinned ? (
                          <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                            Pinned
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs text-muted">
                        {note.content.trim() || "No content yet."}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                        <span>{formatNoteDate(note.updated_at)}</span>
                        {note.category ? <span>· {note.category}</span> : null}
                        {(note.tags ?? []).map((value) => (
                          <span
                            key={value}
                            className="rounded-full border border-border px-1.5 py-0.5"
                          >
                            #{value}
                          </span>
                        ))}
                      </div>

                      {linkedTask ? (
                        <p className="mt-1.5 truncate text-[10px] text-accent">
                          Linked: {linkedTask.title}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Editor */}
        <section className="min-w-0">
          {selected ? (
            <NoteEditor
              // Keyed by note id so opening another note re-seeds the draft
              // state from the right row instead of carrying the old one over.
              key={selected.id}
              note={selected}
              tasks={accountTasks}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={() => selectNote(null)}
            />
          ) : loading ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
              Loading your notes...
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
              <p className="text-sm font-medium">Nothing selected</p>
              <p className="mt-1 text-sm text-muted">
                Open a note from the list, or{" "}
                <button
                  type="button"
                  onClick={handleCreate}
                  className="font-semibold text-accent hover:underline"
                >
                  create a new one
                </button>
                . Your tasks are in{" "}
                <Link href="/tasks" className="font-semibold text-accent hover:underline">
                  Tasks
                </Link>
                .
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/** "14 Oct 2026" - rendered in local time, since the timestamp is an instant. */
function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
