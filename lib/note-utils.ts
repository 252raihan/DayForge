import type { Note } from "@/types";

// Pure helpers for the Notes editor.
//
// They live in their own module (rather than inside NoteEditor.tsx) so the
// test runner can import them without loading a .tsx file - see
// tests/dayforge.test.mjs.

/** How long to wait after the last edit before autosaving. */
export const AUTOSAVE_DELAY_MS = 800;

/** The editor's working copy of a note. */
export type NoteDraft = {
  title: string;
  content: string;
  category: string;
  tags: string[];
  pinned: boolean;
  taskId: string | null;
};

/** Seeds a draft from a stored note. */
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

/**
 * Turns a comma-separated tag input into the array the database expects.
 *
 * Trimmed, lowercased and de-duplicated in input order, so "#Exam" and "exam "
 * are one tag. The database trigger normalises again, so a row written by any
 * other path ends up in the same shape.
 */
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

/** A one-line preview of a note's body, for the list. */
export function notePreview(content: string, maxLength = 140): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= maxLength ? flat : `${flat.slice(0, maxLength - 1)}...`;
}
