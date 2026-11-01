// Skeleton rows for a list that is still loading. Matching the card layout
// means the page does not jump when the real rows arrive.

export function LoadingRows({ count = 3, label }: { count?: number; label?: string }) {
  return (
    <ul className="space-y-2.5" aria-busy="true" aria-label={label ?? "Loading"}>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-xl border border-border bg-surface p-4 shadow-panel"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-4 w-4 rounded border border-border bg-surface-2" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3 w-2/5 rounded bg-surface-2" />
              <div className="h-2.5 w-3/5 rounded bg-surface-2" />
            </div>
            <div className="h-5 w-14 rounded-md bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
