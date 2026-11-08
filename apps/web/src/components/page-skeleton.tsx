/** Static shell shown while a page that depends on its URL streams in. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 pt-8 sm:px-6" aria-hidden="true">
      <div className="h-4 w-48 rounded-full bg-surface-muted" />
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="aspect-[4/3] rounded-[28px] bg-surface-muted" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 rounded-2xl bg-surface-muted" />
          <div className="h-5 w-1/2 rounded-full bg-surface-muted" />
          <div className="h-40 rounded-[28px] bg-surface-muted" />
        </div>
      </div>
    </div>
  );
}
