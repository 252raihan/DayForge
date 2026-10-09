import PageHeader from "@/components/PageHeader";

// Placeholder page. No features yet.
export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Classes, exams and study blocks in a weekly and monthly view."
      />
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Nothing here yet.
      </div>
    </>
  );
}
