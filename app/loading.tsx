import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState } from "@/components/dashboard/loading-state";

/**
 * Streams before any data work starts, so it is on screen while the dataset is read. Cold reads
 * take about 30 seconds; the heading, counter and bar say so instead of a silent grey page.
 */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-10 sm:px-8 sm:py-14">
      <LoadingState />
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        <Skeleton className="h-64 bg-muted/30" />
        <Skeleton className="h-64 bg-muted/30" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3" aria-hidden="true">
        <Skeleton className="h-56 bg-muted/30" />
        <Skeleton className="h-56 bg-muted/30" />
        <Skeleton className="h-56 bg-muted/30" />
      </div>
    </main>
  );
}
