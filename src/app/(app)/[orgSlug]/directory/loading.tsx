import { Skeleton } from "@/components/ui/skeleton";

/** Directory loading state — skeleton rows match the final table/card layout. */
export default function DirectoryLoading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading directory">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
