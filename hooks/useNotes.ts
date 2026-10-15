"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note, NoteInsert, NoteSort, NoteUpdate } from "@/types";

// All Notes data access lives here, mirroring how hooks/useTasks.ts owns tasks:
// the page renders, this hook talks to Supabase and holds loading/error state.
//
// Notes are few and small, so the whole list is fetched once (RLS scopes it to
// the signed-in user) and search/sort/filter happen client-side. That keeps
// typing in the search box instant and means switching sort never waits on the
// network.

export type NoteTagFilter = "__all__";

/** Sentinel for "any tag" in the tag filter. */
export const ALL_TAGS = "__all__" as const;

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tag, setTag] = useState<string>(ALL_TAGS);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sort, setSort] = useState<NoteSort>("updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce the search box so the list only recomputes once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (loadError) {
      console.error("[DayForge] failed to load notes:", loadError.message);
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setNotes((data as Note[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Creates a note and returns it, so the page can select it immediately. */
  const createNote = useCallback(async (values?: Partial<NoteInsert>) => {
    const supabase = createClient();

    const payload: NoteInsert = {
      title: values?.title ?? "",
      content: values?.content ?? "",
      category: values?.category ?? null,
      tags: values?.tags ?? [],
      pinned: values?.pinned ?? false,
      task_id: values?.task_id ?? null,
    };

    // user_id is omitted: the column defaults to auth.uid().
    const { data, error: insertError } = await supabase
      .from("notes")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      console.error("[DayForge] failed to create note:", insertError.message);
      throw new Error("Could not create the note. Please try again.");
    }

    const note = data as Note;
    setNotes((prev) => [note, ...prev]);
    return note;
  }, []);

  /**
   * Updates a note and swaps in the row the server returned, rather than
   * assuming the write landed: `.select()` means a save that matched no rows
   * (an RLS-filtered id, a deleted note) is reported as a failure instead of
   * showing the user text that was never stored.
   */
  const updateNote = useCallback(async (id: string, values: NoteUpdate) => {
    const supabase = createClient();

    const { data, error: updateError } = await supabase
      .from("notes")
      .update(values)
      .eq("id", id)
      .select();

    if (updateError) {
      console.error("[DayForge] failed to update note:", updateError.message);
      throw new Error("Could not save this note. Please try again.");
    }

    if (!data || data.length === 0) {
      console.error("[DayForge] note update matched no rows:", id);
      throw new Error("This note no longer exists. It may have been deleted in another tab.");
    }

    const saved = data[0] as Note;
    setNotes((prev) => prev.map((note) => (note.id === id ? saved : note)));
    return saved;
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const supabase = createClient();

    const { data, error: deleteError } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .select("id");

    if (deleteError) {
      console.error("[DayForge] failed to delete note:", deleteError.message);
      throw new Error("Could not delete the note. Please try again.");
    }

    if (!data || data.length === 0) {
      console.error("[DayForge] note delete matched no rows:", id);
      throw new Error("This note no longer exists. It may have been deleted in another tab.");
    }

    setNotes((prev) => prev.filter((note) => note.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  /** Every tag in use, for the tag filter and the tag chooser. */
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) for (const value of note.tags ?? []) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  /**
   * The visible list: search over title, content and tags, then the tag and
   * pinned filters, then the chosen sort. Pinned notes float to the top of any
   * sort, because that is the whole point of pinning one.
   */
  const visibleNotes = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();

    const matched = notes.filter((note) => {
      if (pinnedOnly && !note.pinned) return false;
      if (tag !== ALL_TAGS && !(note.tags ?? []).includes(tag)) return false;
      if (!needle) return true;

      const haystack = [note.title, note.content, note.category ?? "", ...(note.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    return [...matched].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return compareNotes(a, b, sort);
    });
  }, [notes, debouncedSearch, tag, pinnedOnly, sort]);

  // Which note the editor pane shows. A selected note wins even if the current
  // search hides it (otherwise the editor would jump while the user is typing),
  // and with nothing selected the first visible note is opened.
  const selected = useMemo(() => {
    if (selectedId) {
      const found = notes.find((note) => note.id === selectedId);
      if (found) return found;
    }
    return visibleNotes[0] ?? null;
  }, [notes, selectedId, visibleNotes]);

  const hasActiveRefinements =
    debouncedSearch.trim() !== "" || tag !== ALL_TAGS || pinnedOnly;

  const clearRefinements = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setTag(ALL_TAGS);
    setPinnedOnly(false);
  }, []);

  return {
    notes,
    visibleNotes,
    selected,
    selectNote: setSelectedId,

    tags,
    loading,
    error,
    reload: load,

    // Toolbar
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

    // Mutations
    createNote,
    updateNote,
    deleteNote,
  };
}

/** The chosen sort, applied to a single note pair. */
function compareNotes(a: Note, b: Note, sort: NoteSort): number {
  switch (sort) {
    case "created":
      return b.created_at.localeCompare(a.created_at);
    case "title":
      // Untitled notes read better grouped at the end.
      if (!a.title.trim() && !b.title.trim()) return b.updated_at.localeCompare(a.updated_at);
      if (!a.title.trim()) return 1;
      if (!b.title.trim()) return -1;
      return a.title.localeCompare(b.title);
    case "updated":
    default:
      return b.updated_at.localeCompare(a.updated_at);
  }
}
