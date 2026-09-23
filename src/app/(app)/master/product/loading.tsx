import { Card, PageHeader } from "@/components/ui";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default function MasterProductLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Product"
        description="Daftar product beserta HPP (modal) dan grup pembukuannya. HPP dipakai untuk menghitung profit."
      />

      {/* isi harga massal + bersihkan product */}
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Bar className="h-4 w-48 max-w-full" />
              <Bar className="h-3 w-72 max-w-full" />
            </div>
            <Bar className="h-9 w-28" />
          </div>
        </Card>
      ))}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* tambah product */}
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 p-5">
            <Bar className="h-5 w-40" />
            <Bar className="mt-2 h-3 w-64" />
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Bar className="h-3 w-24" />
                <Bar className="h-10 w-full" />
              </div>
            ))}
            <Bar className="h-10 w-36" />
          </div>
        </Card>

        {/* grup pembukuan */}
        <Card>
          <div className="border-b border-slate-100 p-5">
            <Bar className="h-5 w-36" />
            <Bar className="mt-2 h-3 w-48" />
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Bar className="h-3 w-20" />
              <Bar className="h-10 w-full" />
            </div>
            <Bar className="h-10 w-32" />
            <div className="flex flex-wrap gap-1.5">
              {["w-20", "w-16", "w-24"].map((w, i) => (
                <Bar key={i} className={`h-6 rounded-full ${w}`} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* daftar product */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <div className="min-w-0 space-y-2">
            <Bar className="h-5 w-44 max-w-full" />
            <Bar className="h-3 w-60 max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Bar className="h-10 w-40 sm:w-48" />
            <Bar className="h-10 w-24" />
          </div>
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex items-center justify-between gap-4">
              <Bar className="h-4 w-40 sm:w-56" />
              <Bar className="hidden h-4 w-24 sm:block" />
              <Bar className="h-4 w-20 sm:w-24" />
              <Bar className="h-9 w-20 sm:w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
