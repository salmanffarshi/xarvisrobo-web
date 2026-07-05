import { Skeleton } from "@/components/ui/skeleton";

// Streamed by Next while the /products server component fetches data.
export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Skeleton className="h-12 w-56" />
      <Skeleton className="mt-4 h-6 w-96 max-w-full" />
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-44 sm:ml-auto" />
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-neutral-200 bg-white p-3"
          >
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="px-2 pb-2 pt-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-3 h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
