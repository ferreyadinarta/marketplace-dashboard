import { Card, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n-server";

// Skeleton yang tampil INSTAN saat filter/paginasi diganti (loading boundary Next.js).
// Memberi feedback "sedang memuat" tanpa layar kosong / data lama menggantung.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default async function StokLoading() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Stok", "Stock")}
        description={t(
          "Pantau stok tiap product. Stok otomatis berkurang dari order yang Selesai (COMPLETED), bertambah dari barang masuk, dan bisa disamakan dengan hitungan fisik lewat opname.",
          "Monitor stock for every product. Stock automatically decreases from Completed orders, increases from stock in, and can be matched with a physical count."
        )}
      />

      {/* ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex items-center gap-3 p-4">
            <Bar className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Bar className="h-3 w-24" />
              <Bar className="h-6 w-12" />
            </div>
          </Card>
        ))}
      </div>

      {/* barang masuk (restock) */}
      <Card className="p-5">
        <div className="mb-4 space-y-1.5">
          <Bar className="h-5 w-48" />
          <Bar className="h-3 w-64" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-3 w-20" />
              <Bar className="h-10 w-40" />
            </div>
          ))}
          <Bar className="h-10 w-28" />
        </div>
      </Card>

      {/* opname massal */}
      <Card className="flex items-center justify-between p-5">
        <Bar className="h-5 w-40" />
        <Bar className="h-8 w-24" />
      </Card>

      {/* daftar stok */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Bar className="h-5 w-36" />
          <div className="flex flex-wrap items-center gap-2">
            <Bar className="h-10 w-48" />
            <Bar className="h-10 w-24" />
          </div>
        </div>

        {/* header row */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <Bar className="h-3 w-40" />
          <Bar className="h-3 w-16" />
          <Bar className="h-3 w-12" />
          <Bar className="h-3 w-16" />
          <Bar className="h-3 w-16" />
          <Bar className="h-3 w-24" />
        </div>

        {/* rows */}
        <div className="space-y-3 pt-3">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex items-center justify-between gap-4">
              <Bar className="h-4 w-40" />
              <Bar className="h-4 w-16" />
              <Bar className="h-4 w-12" />
              <Bar className="h-4 w-16" />
              <Bar className="h-4 w-16" />
              <Bar className="h-8 w-28" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
