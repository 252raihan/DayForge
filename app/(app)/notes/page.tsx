import PageHeader from "@/components/PageHeader";

// Placeholder page. No features yet.
export default function NotesPage() {
  return (
    <>
      <PageHeader
        title="Notes"
        description="Lecture notes, quick thoughts and revision material."
      />
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Nothing here yet.
      </div>
    </>
  );
}
