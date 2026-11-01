// Tiny class-name joiner used by the shared UI primitives.
// Keeps conditional classes readable without adding a dependency.
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
