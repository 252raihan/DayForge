// Error banner for a failed Supabase query. `message` is the real error text
// from the client; Retry re-runs the load. It unmounts as soon as the caller
// clears its `error` on a successful reload.
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
    >
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
