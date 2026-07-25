// Skeleton loading saat pindah halaman (route transition).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200/70" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-28 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
