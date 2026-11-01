"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingRows,
  Select,
} from "@/components/ui";
import NoteEditor, { type NoteDraft } from "@/components/notes/NoteEditor";
import { NotesIcon, PlusIcon, SearchIcon, PinIcon } from "@/components/icons";
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
      <PageHeader
        title="Notes"
        description="Lecture notes, quick thoughts and revision material. Changes save as you type."
        actions={
          <Button onClick={handleCreate} loading={creating} loadingLabel="Creating...">
            <PlusIcon className="h-4 w-4" strokeWidth={2} />
            New note
          </Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <Alert onDismiss={() => setActionError(null)}>{actionError}</Alert>
        </div>
      ) : null}

      {/* Toolbar: search, tag filter, sort and the pinned toggle. */}
      <Card className="mb-4 p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="notes-search" className="sr-only">
              Search notes
            </label>
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
              <SearchIcon className="h-4 w-4" />
            </span>
            <Input
              id="notes-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="h-8 bg-surface-2 pl-8 shadow-none"
            />
          </div>

          <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            <label htmlFor="notes-tag" className="sr-only">
              Filter by tag
            </label>
            <Select
              id="notes-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="h-8 w-auto shrink-0 border-transparent bg-surface-2 py-0 text-xs shadow-none"
            >
              <option value={ALL_TAGS}>All tags</option>
              {tags.map((value) => (
                <option key={value} value={value}>
                  #{value}
                </option>
              ))}
            </Select>

            <label htmlFor="notes-sort" className="sr-only">
              Sort notes
            </label>
            <Select
              id="notes-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as NoteSort)}
              className="h-8 w-auto shrink-0 border-transparent bg-surface-2 py-0 text-xs shadow-none"
            >
              <option value="updated">Last updated</option>
              <option value="created">Date created</option>
              <option value="title">Title</option>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              active={pinnedOnly}
              onClick={() => setPinnedOnly((prev) => !prev)}
              aria-pressed={pinnedOnly}
              className="shrink-0"
            >
              <PinIcon className="h-3.5 w-3.5" />
              Pinned
            </Button>

            {hasActiveRefinements ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearRefinements}
                className="shrink-0"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
        {/* List */}
        <section className="min-w-0">
          {loading ? (
            <LoadingRows count={3} label="Loading notes" />
          ) : visibleNotes.length === 0 ? (
            <EmptyState
              icon={<NotesIcon className="h-5 w-5" />}
              title={hasActiveRefinements ? "No matching notes" : "No notes yet"}
              hint={
                hasActiveRefinements
                  ? "Try a different search term, tag or filter."
                  : "Create your first note to keep lecture material, ideas and revision in one place."
              }
              actionLabel={hasActiveRefinements ? "Clear filters" : "New note"}
              onClick={hasActiveRefinements ? clearRefinements : handleCreate}
            />
          ) : (
            <ul className="space-y-1.5">
              {visibleNotes.map((note) => {
                const isActive = selected?.id === note.id;
                const linkedTask = note.task_id ? tasksById.get(note.task_id) : undefined;
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => selectNote(note.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isActive
                          ? "border-accent/40 bg-accent-soft"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`min-w-0 truncate text-[13px] font-medium ${
                            isActive ? "text-accent" : "text-fg"
                          }`}
                        >
                          {note.title.trim() || "Untitled note"}
                        </p>
                        {note.pinned ? (
                          <PinIcon
                            className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-accent" : "text-muted"}`}
                          />
                        ) : null}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                        {note.content.trim() || "No content yet."}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs text-muted">
                        <span className="tabular-nums">{formatNoteDate(note.updated_at)}</span>
                        {note.category ? (
                          <>
                            <span className="text-muted/60" aria-hidden="true">·</span>
                            <span className="truncate">{note.category}</span>
                          </>
                        ) : null}
                        {(note.tags ?? []).slice(0, 2).map((value) => (
                          <span
                            key={value}
                            className="rounded border border-border bg-surface-2 px-1 py-px text-3xs"
                          >
                            #{value}
                          </span>
                        ))}
                        {(note.tags?.length ?? 0) > 2 ? (
                          <span className="text-3xs">+{(note.tags?.length ?? 0) - 2}</span>
                        ) : null}
                      </div>

                      {linkedTask ? (
                        <p className="mt-1.5 flex items-center gap-1 truncate text-3xs text-accent">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                          {linkedTask.title}
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
        <section className="min-w-0 lg:sticky lg:top-20">
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
            <Card className="text-[13px] text-muted">Loading your notes…</Card>
          ) : (
            <EmptyState
              icon={<NotesIcon className="h-5 w-5" />}
              title="Nothing selected"
              hint="Open a note from the list, or start a new one. Everything you write is saved automatically."
              actionLabel="New note"
              onClick={handleCreate}
              className="lg:min-h-[24rem]"
            />
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
