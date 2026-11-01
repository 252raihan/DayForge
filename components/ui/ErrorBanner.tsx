import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

// Error banner for a failed Supabase query. `message` is the real error text
// from the client; Retry re-runs the load. It unmounts as soon as the caller
// clears its `error` on a successful reload.
export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <Alert
      tone="error"
      onDismiss={onDismiss}
      action={
        onRetry ? (
          <Button variant="dangerSubtle" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}
