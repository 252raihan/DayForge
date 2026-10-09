// Consistent page heading used by every route under app/(app).
// Keeps the spacing scale and type sizes identical across pages.
export default function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
      ) : null}
    </div>
  );
}
