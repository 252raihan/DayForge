import PageHeader from "@/components/PageHeader";

// Placeholder page. No features yet.
export default function HabitsPage() {
  return (
    <>
      <PageHeader
        title="Habits"
        description="Daily and weekly routines you want to repeat, with streaks."
      />
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Nothing here yet.
      </div>
    </>
  );
}
