import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
         </div>
         <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
         </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
         {Array.from({ length: 4 }).map((_, i) => (
           <Skeleton key={i} className="h-32 w-full rounded-xl" />
         ))}
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="md:col-span-1 lg:col-span-4 h-full">
           <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
        <div className="md:col-span-1 lg:col-span-3 h-full">
           <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1">
         <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
