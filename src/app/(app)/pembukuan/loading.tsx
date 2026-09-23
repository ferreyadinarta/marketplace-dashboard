import { Card, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n-server";

// Skeleton yang tampil INSTAN saat filter diganti (loading boundary Next.js).
// Memberi feedback "sedang memuat" tanpa layar kosong / data lama menggantung.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default async function PembukuanLoading() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Pembukuan", "Bookkeeping")}
        description={t(
          "Penjualan tiap product dikelompokkan per grup. Atur rentang tanggal & marketplace, lalu export ke Excel.",
          "Sales for each product are grouped per bookkeeping group. Set the date range & marketplace, then export to Excel."
        )}
      />

      {/* filter bar */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-3 w-24" />
              <Bar className="h-10 w-40" />
            </div>
          ))}
          <Bar className="h-10 w-24" />
          <Bar className="ml-auto h-10 w-32" />
        </div>
      </Card>

      {/* total profit */}
      <Card className="flex items-center justify-between p-5">
        <Bar className="h-4 w-48" />
        <Bar className="h-7 w-40" />
      </Card>

      {/* grup-grup */}
      {Array.from({ length: 2 }).map((_, g) => (
        <Card key={g} className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <Bar className="h-5 w-32" />
            <Bar className="h-4 w-28" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, r) => (
              <div key={r} className="flex items-center justify-between gap-4">
                <Bar className="h-4 w-40" />
                <Bar className="h-4 w-20" />
                <Bar className="h-4 w-24" />
                <Bar className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
