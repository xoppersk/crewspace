import { Skeleton } from "@/components/ui/skeleton";

/** Teams loading state — skeleton cards match the final grid layout. */
export default function TeamsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading teams">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
