import { Handshake, Trash2, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { rupiah, tanggal, currentMonthRange } from "@/lib/format";
import { getStockLevels } from "@/lib/stock";
import { Card, CardHeader, PageHeader, EmptyState } from "@/components/ui";
import { AddKonsinyasiStoreForm, MultiItemSaleForm, StoreChip } from "@/components/KonsinyasiForms";
import { SubmitButton } from "@/components/SubmitButton";
import { Pagination } from "@/components/Pagination";
import {
  createKonsinyasiStore,
  createKonsinyasiSale,
  deleteKonsinyasiSale,
  deleteKonsinyasiStore,
} from "./actions";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const PER_PAGE = 15;

export default async function KonsinyasiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const page = Math.max(1, parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) ?? "1", 10) || 1);

  const where = { store: { marketplace: "KONSINYASI" } };
  const [stores, products, sales, total] = await Promise.all([
    prisma.store.findMany({
      where: { marketplace: "KONSINYASI" },
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true } } },
    }),
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

  const levels = await getStockLevels();
  const stockMap = new Map(levels.map((l) => [l.productId, l.status === "UNSET" ? null : l.current]));

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const fromRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const toRow = Math.min(page * PER_PAGE, total);
  const pageHref = (p: number) => `/konsinyasi${p > 1 ? `?page=${p}` : ""}`;

  const storeOptions = stores.map((s) => ({ value: s.id, label: s.name }));
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
        title={t("Grosir / Reseller", "Wholesale / Reseller")}
        description={t(
          "Penjualan jual putus ke toko/reseller (dibayar di depan saat kirim). Otomatis masuk ke pembukuan, dashboard, & stok.",
          "Outright sales to stores/resellers (paid upfront on delivery). Automatically added to bookkeeping, the dashboard, and stock."
        )}
      />

      <Card>
        <CardHeader
          title={t("Toko / Reseller", "Stores / Resellers")}
          subtitle={t("Daftar toko/reseller yang beli grosir dari kamu.", "List of stores/resellers that buy wholesale from you.")}
        />
        <AddKonsinyasiStoreForm action={createKonsinyasiStore} existingNames={stores.map((s) => s.name)} />
        {stores.length > 0 && (
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto px-5 pb-5">
            {stores.map((s) => (
              <StoreChip
                key={s.id}
                store={{ id: s.id, name: s.name, count: s._count.orders }}
                deleteAction={deleteKonsinyasiStore}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={t("Catat Penjualan Grosir", "Record a Wholesale Sale")}
          subtitle={t("Satu baris = satu penjualan jual putus.", "One row = one outright sale.")}
        />
        <MultiItemSaleForm
          variant="grosir"
          stores={storeOptions}
          products={productOptions}
          action={createKonsinyasiSale}
          today={today}
        />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t(`Riwayat Penjualan (${total})`, `Sales History (${total})`)}
          subtitle={t("Penjualan grosir yang sudah dicatat.", "Wholesale sales recorded so far.")}
        />
        {sales.length === 0 ? (
          <EmptyState
            icon={<Package size={40} />}
            title={t("Belum ada penjualan grosir", "No wholesale sales yet")}
            description={t("Catat penjualan pertama lewat form di atas.", "Record your first sale using the form above.")}
          />
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">{t("Tanggal", "Date")}</th>
                  <th className="px-5 py-3 font-medium">{t("Toko / Reseller", "Store / Reseller")}</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Jumlah", "Qty")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Omzet", "Revenue")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Hapus", "Delete")}</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((o) => {
                  const totalQty = o.items.reduce((a, it) => a + it.qty, 0);
                  return (
                    <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-5 py-3 align-top text-slate-600">{tanggal(o.orderDate, lang)}</td>
                      <td className="px-5 py-3 align-top text-slate-600">{o.store.name}</td>
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
          <div className="space-y-3 p-4 md:hidden">
            {sales.map((o) => {
              const totalQty = o.items.reduce((a, it) => a + it.qty, 0);
              return (
                <div key={o.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-slate-900">{o.store.name}</div>
                    <form action={deleteKonsinyasiSale} className="inline shrink-0">
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
                  <div className="mt-3 flex flex-col">
                    <span className="text-[11px] text-slate-400">Product</span>
                    <div className="space-y-0.5 text-sm font-medium text-slate-900">
                      {o.items.map((it) => (
                        <div key={it.id}>
                          {it.productName} <span className="text-slate-400">×{it.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">{t("Tanggal", "Date")}</span>
                      <span className="text-sm text-slate-600">{tanggal(o.orderDate, lang)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">{t("Jumlah", "Qty")}</span>
                      <span className="text-sm text-slate-600">{totalQty}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">{t("Omzet", "Revenue")}</span>
                      <span className="text-sm font-semibold tabular-nums text-emerald-600">{rupiah(o.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          from={fromRow}
          to={toRow}
          hrefFor={pageHref}
          unit={t("penjualan", "sales")}
        />
      </Card>
    </div>
  );
}
