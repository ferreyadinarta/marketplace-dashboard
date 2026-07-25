import { Handshake, Trash2, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { rupiah, tanggal, currentMonthRange } from "@/lib/format";
import { Card, CardHeader, PageHeader, EmptyState } from "@/components/ui";
import { AddKonsinyasiStoreForm, KonsinyasiSaleForm } from "@/components/KonsinyasiForms";
import { SubmitButton } from "@/components/SubmitButton";
import { Pagination } from "@/components/Pagination";
import { createKonsinyasiStore, createKonsinyasiSale, deleteKonsinyasiSale } from "./actions";

export const dynamic = "force-dynamic";

const PER_PAGE = 15;

export default async function KonsinyasiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) ?? "1", 10) || 1);

  const where = { store: { marketplace: "KONSINYASI" } };
  const [stores, products, sales, total] = await Promise.all([
    prisma.store.findMany({ where: { marketplace: "KONSINYASI" }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where,
      include: { store: true, items: true },
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const fromRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const toRow = Math.min(page * PER_PAGE, total);
  const pageHref = (p: number) => `/konsinyasi${p > 1 ? `?page=${p}` : ""}`;

  const storeOptions = stores.map((s) => ({ value: s.id, label: s.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  const today = currentMonthRange().to;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konsinyasi / Titip Jual"
        description="Catat penjualan product yang dititip di toko lain. Otomatis ikut masuk ke pembukuan & dashboard."
      />

      <Card>
        <CardHeader title="Toko Konsinyasi" subtitle="Daftar tempat kamu menitip product." />
        <AddKonsinyasiStoreForm action={createKonsinyasiStore} />
        {stores.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-5">
            {stores.map((s) => (
              <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Catat Penjualan Konsinyasi" subtitle="Satu baris = satu penjualan." />
        <KonsinyasiSaleForm
          stores={storeOptions}
          products={productOptions}
          action={createKonsinyasiSale}
          today={today}
        />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={`Riwayat Penjualan (${total})`} subtitle="Penjualan konsinyasi yang sudah dicatat." />
        {sales.length === 0 ? (
          <EmptyState
            icon={<Package size={40} />}
            title="Belum ada penjualan konsinyasi"
            description="Catat penjualan pertama lewat form di atas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  <th className="px-5 py-3 font-medium">Toko</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 text-right font-medium">Terjual</th>
                  <th className="px-5 py-3 text-right font-medium">Omzet</th>
                  <th className="px-5 py-3 text-right font-medium">Komisi</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                  <th className="px-5 py-3 text-right font-medium">Hapus</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((o) => {
                  const it = o.items[0];
                  return (
                    <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{tanggal(o.orderDate)}</td>
                      <td className="px-5 py-3 text-slate-600">{o.store.name}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{it?.productName ?? "-"}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{it?.qty ?? 0}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{rupiah(o.totalAmount)}</td>
                      <td className="px-5 py-3 text-right text-red-500">{rupiah(o.marketplaceFee)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-600">{rupiah(o.netAmount)}</td>
                      <td className="px-5 py-3 text-right">
                        <form action={deleteKonsinyasiSale} className="inline">
                          <input type="hidden" name="id" value={o.id} />
                          <SubmitButton
                            variant="ghost"
                            className="px-2 py-1.5 text-red-500 hover:bg-red-50"
                            pendingText="…"
                          >
                            <Trash2 size={16} />
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          from={fromRow}
          to={toRow}
          hrefFor={pageHref}
          unit="penjualan"
        />
      </Card>
    </div>
  );
}
