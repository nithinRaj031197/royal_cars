import { Skeleton } from "@/components/ui";

/**
 * Route-level loading state for the authenticated app.
 *
 * Every page here is dynamic and reads from Google Sheets, so a navigation can
 * take a moment. Without this, Next renders nothing until the server responds
 * and the screen simply sits on the previous page — which reads as a broken
 * link. A skeleton that matches the usual page shape makes the wait legible.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Page header */}
      <div className="mb-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>

      {/* Tiles — most pages open with a row of them */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>

      {/* Table/list body */}
      <div className="card mt-4 divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
