import { Card, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n-server";

// Skeleton yang tampil INSTAN saat dashboard sedang memuat (loading boundary Next.js).
// Memberi feedback "sedang memuat" tanpa layar kosong / data lama menggantung.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default async function DashboardLoading() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={t(
          "Ringkasan penjualan & profit dari seluruh toko dan marketplace.",
          "Summary of sales & profit across all stores and marketplaces."
        )}
      />

      {/* aksi cepat */}
      <Card className="p-4">
        <Bar className="mb-3 h-3 w-24" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} className="h-[68px] w-full" />
          ))}
        </div>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <Bar className="h-3 w-24" />
              <Bar className="h-8 w-8 rounded-lg" />
            </div>
            <Bar className="h-7 w-32" />
            <Bar className="h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* chart */}
      <Card>
        <div className="border-b border-slate-100 p-5">
          <Bar className="h-5 w-56" />
          <Bar className="mt-2 h-3 w-40" />
        </div>
        <div className="p-5">
          <Bar className="h-64 w-full" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* per marketplace */}
        <Card>
          <div className="border-b border-slate-100 p-5">
            <Bar className="h-5 w-56" />
            <Bar className="mt-2 h-3 w-40" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, r) => (
              <div key={r} className="flex items-center justify-between gap-4">
                <Bar className="h-4 w-28" />
                <Bar className="h-4 w-16" />
                <Bar className="h-4 w-24" />
                <Bar className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>

        {/* best sellers */}
        <Card>
          <div className="border-b border-slate-100 p-5">
            <Bar className="h-5 w-40" />
            <Bar className="mt-2 h-3 w-48" />
          </div>
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <Bar className="h-7 w-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Bar className="h-4 w-40" />
                  <Bar className="h-3 w-20" />
                </div>
                <Bar className="h-4 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
