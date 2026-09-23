import { MessageCircle, Trash2, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { rupiah, tanggal, currentMonthRange } from "@/lib/format";
import { getStockLevels } from "@/lib/stock";
import { Card, CardHeader, PageHeader, EmptyState } from "@/components/ui";
import { MultiItemSaleForm } from "@/components/KonsinyasiForms";
import { SubmitButton } from "@/components/SubmitButton";
import { Pagination } from "@/components/Pagination";
import { createWaSale, deleteWaSale } from "./actions";

export const dynamic = "force-dynamic";

const PER_PAGE = 15;

export default async function WaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) ?? "1", 10) || 1);

  const where = { store: { marketplace: "WA" } };
  const [products, sales, total] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.order.count({ where }),
  ]);

  const levels = await getStockLevels();
  const stockMap = new Map(levels.map((l) => [l.productId, l.status === "UNSET" ? null : l.current]));

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const fromRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const toRow = Math.min(page * PER_PAGE, total);
  const pageHref = (p: number) => `/wa${p > 1 ? `?page=${p}` : ""}`;

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.sku})`,
    unit: p.unit,
    packUnit: p.packUnit,
    packSize: p.packSize,
    stock: stockMap.get(p.id) ?? null,
    priceRetail: p.priceRetail,
    priceGrosir: p.priceGrosir,
    missingHpp: !p.isBundle && p.hpp === 0,
  }));
  const today = currentMonthRange().to;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penjualan WA / Offline"
        description="Catat penjualan manual lewat WhatsApp atau offline ke pembeli langsung. Otomatis masuk ke pembukuan, dashboard, & stok."
      />

      <Card>
        <CardHeader title="Catat Penjualan WA" subtitle="Satu baris = satu penjualan retail." />
        <MultiItemSaleForm variant="wa" products={productOptions} action={createWaSale} today={today} />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={`Riwayat Penjualan (${total})`} subtitle="Penjualan WA / offline yang sudah dicatat." />
        {sales.length === 0 ? (
          <EmptyState
            icon={<Package size={40} />}
            title="Belum ada penjualan WA"
            description="Catat penjualan pertama lewat form di atas."
          />
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  <th className="px-5 py-3 font-medium">Pembeli</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 text-right font-medium">Jumlah</th>
                  <th className="px-5 py-3 text-right font-medium">Omzet</th>
                  <th className="px-5 py-3 text-right font-medium">Hapus</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((o) => {
                  const totalQty = o.items.reduce((a, it) => a + it.qty, 0);
                  return (
                    <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-5 py-3 align-top text-slate-600">{tanggal(o.orderDate)}</td>
                      <td className="px-5 py-3 align-top text-slate-600">{o.buyerName ?? "-"}</td>
                      <td className="px-5 py-3 align-top font-medium text-slate-900">
                        <div className="space-y-0.5">
                          {o.items.map((it) => (
                            <div key={it.id}>
                              {it.productName} <span className="text-slate-400">×{it.qty}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right align-top text-slate-600">{totalQty}</td>
                      <td className="px-5 py-3 text-right align-top font-semibold text-emerald-600">{rupiah(o.totalAmount)}</td>
                      <td className="px-5 py-3 text-right align-top">
                        <form action={deleteWaSale} className="inline">
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
        {sales.length > 0 && (
          <div className="space-y-3 p-4 md:hidden">
            {sales.map((o) => {
              const totalQty = o.items.reduce((a, it) => a + it.qty, 0);
              return (
                <div key={o.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{tanggal(o.orderDate)}</div>
                    <form action={deleteWaSale} className="inline">
                      <input type="hidden" name="id" value={o.id} />
                      <SubmitButton
                        variant="ghost"
                        className="px-2 py-1.5 text-red-500 hover:bg-red-50"
                        pendingText="…"
                      >
                        <Trash2 size={16} />
                      </SubmitButton>
                    </form>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <span className="text-[11px] text-slate-400">Pembeli</span>
                      <div className="text-sm text-slate-600">{o.buyerName ?? "-"}</div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400">Product</span>
                      <div className="space-y-0.5 text-sm font-medium text-slate-900">
                        {o.items.map((it) => (
                          <div key={it.id}>
                            {it.productName} <span className="text-slate-400">×{it.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] text-slate-400">Jumlah</span>
                        <div className="text-sm tabular-nums text-slate-600">{totalQty}</div>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Omzet</span>
                        <div className="text-sm font-semibold tabular-nums text-emerald-600">{rupiah(o.totalAmount)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
