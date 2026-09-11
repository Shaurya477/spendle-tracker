import { Skeleton } from "@/components/ui/skeleton";
import { Eyebrow } from "@/components/dashboard/primitives";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-3">
        <Eyebrow>Reading Ethereum mainnet…</Eyebrow>
        <Skeleton className="h-16 w-2/3 max-w-xl bg-muted/60" />
        <Skeleton className="h-4 w-1/2 max-w-md bg-muted/40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 bg-muted/40" />
        <Skeleton className="h-64 bg-muted/40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 bg-muted/40" />
        <Skeleton className="h-56 bg-muted/40" />
        <Skeleton className="h-56 bg-muted/40" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-96 bg-muted/40" />
        <Skeleton className="h-96 bg-muted/40" />
      </div>
    </main>
  );
}
