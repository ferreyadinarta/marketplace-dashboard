import { Boxes } from "lucide-react";
import { getPembukuanByGroup, getStores, getGroups, NO_GROUP } from "@/lib/queries";
import { parseFilter, resolvePeriod } from "@/lib/parseFilter";
import { rupiah, currentMonthRange } from "@/lib/format";
import { Suspense } from "react";
import PembukuanFilter from "@/components/PembukuanFilter";
import { RememberFilters } from "@/components/RememberFilters";
import { Card, PageHeader, EmptyState, LinkButton, HelpHint } from "@/components/ui";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

// Nama grup untuk bucket semu (groupId "__none__" / "__unmapped__") datang
// hardcoded bahasa Indonesia dari lib/queries.ts (file itu bukan punya kita) →
// dipetakan ke label terjemahan di sini, by groupId.
function groupLabel(groupId: string, groupName: string, t: (id: string, en: string) => string) {
  if (groupId === NO_GROUP) return t("Tanpa Grup", "No group");
  if (groupId === "__unmapped__") return t("SKU belum dipetakan", "Unmapped SKU");
  return groupName;
}

// Baris "SKU belum dipetakan" juga muncul sebagai nama product di bucket
// khusus itu (productId "__unmapped__") — pakai label terjemahan yang sama.
function rowName(productId: string, name: string, t: (id: string, en: string) => string) {
  return productId === "__unmapped__" ? t("SKU belum dipetakan", "Unmapped SKU") : name;
}

export default async function PembukuanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { t } = await getT();

  // Periode aktif: default "Semua data"; bisa dipersempit ke rentang custom.
  const period = resolvePeriod(sp, true);
  const def = currentMonthRange();
  const filter = parseFilter({ ...sp, from: period.from, to: period.to });
  const [groups, stores, groupList] = await Promise.all([
    getPembukuanByGroup(filter),
    getStores(),
    getGroups(),
  ]);

  const adaProduct = groups.some((g) => g.rows.length > 0);
  const totalProfit = groups.reduce((a, g) => a + g.subtotal.profit, 0);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <RememberFilters storageKey="filters:pembukuan" />
      </Suspense>
      <PageHeader
        title={t("Pembukuan", "Bookkeeping")}
        description={t(
          "Penjualan tiap product per grup, hanya dari pesanan yang sudah selesai, jadi angkanya final. Dashboard juga menghitung pesanan yang masih dikirim.",
          "Sales for each product per group, from completed orders only, so the numbers are final. The dashboard also counts orders still being shipped."
        )}
      />

      <Card className="p-5">
        <PembukuanFilter stores={stores} groups={groupList} initialFrom={def.from} initialTo={def.to} />
      </Card>

      {!adaProduct ? (
        <Card>
          <EmptyState
            icon={<Boxes size={40} />}
            title={t("Belum ada product untuk dibukukan", "No products to book yet")}
            description={t(
              "Tambahkan product beserta HPP dan kelompokkan ke grup pembukuan dulu.",
              "Add products with their COGS and assign them to a bookkeeping group first."
            )}
            action={<LinkButton href="/master/product">{t("Ke halaman Product", "Go to Product page")}</LinkButton>}
          />
        </Card>
      ) : (
        <>
          {/* ringkas total */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <span className="text-sm text-slate-500">{t("Total profit bersih (sesuai filter)", "Total net profit (per filter)")}</span>
            <span className="text-xl font-bold text-emerald-600">{rupiah(totalProfit)}</span>
          </div>

          {groups.map((g) => {
            const label = groupLabel(g.groupId, g.groupName, t);
            return (
            <Card key={g.groupId} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <h2 className="font-semibold text-slate-900">{label}</h2>
                <span className="text-sm text-slate-500">
                  {t("Profit:", "Profit:")}{" "}
                  <span className="font-semibold text-emerald-600">{rupiah(g.subtotal.profit)}</span>
                </span>
              </div>
              {/* table-fixed + lebar kolom eksplisit → semua grup sejajar & muat
                  tanpa scroll ke kanan. Jumlah terjual pindah jadi sub-teks nama. */}
              <div className="hidden md:block">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[32%] px-5 py-2.5 font-medium">Product</th>
                      <th className="w-[18%] px-5 py-2.5 font-medium">SKU</th>
                      <th className="w-[16%] px-5 py-2.5 text-right font-medium">{t("Omzet", "Revenue")}</th>
                      <th className="w-[12%] px-5 py-2.5 text-right font-medium">
                        Fee<HelpHint text={t("Potongan marketplace, dibagi rata per item dalam order.", "Marketplace fees, split evenly per item in the order.")} />
                      </th>
                      <th className="w-[12%] px-5 py-2.5 text-right font-medium">
                        {t("HPP/unit", "COGS/unit")}<HelpHint text={t("Modal per satu unit product.", "Cost of goods per single product unit.")} />
                      </th>
                      <th className="w-[16%] px-5 py-2.5 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.productId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-5 py-2.5">
                          <p className="truncate font-medium text-slate-900" title={rowName(r.productId, r.name, t)}>
                            {rowName(r.productId, r.name, t)}
                          </p>
                          <p className="text-[11px] text-slate-400">{t(`${r.terjual} terjual`, `${r.terjual} sold`)}</p>
                        </td>
                        <td className="truncate px-5 py-2.5 font-mono text-xs text-slate-500" title={r.sku}>
                          {r.sku}
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-600">{rupiah(r.omzet)}</td>
                        <td className="px-5 py-2.5 text-right text-red-500">{rupiah(r.fee)}</td>
                        <td className="px-5 py-2.5 text-right text-slate-400">{rupiah(r.hpp)}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-emerald-600">{rupiah(r.profit)}</td>
                      </tr>
                    ))}
                    {g.rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                          {t("Belum ada product di grup ini", "No products in this group yet")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                      <td className="px-5 py-2.5" colSpan={2}>
                        {t(`Subtotal ${label}`, `Subtotal ${label}`)}
                      </td>
                      <td className="px-5 py-2.5 text-right">{rupiah(g.subtotal.omzet)}</td>
                      <td className="px-5 py-2.5 text-right text-red-500">{rupiah(g.subtotal.fee)}</td>
                      <td className="px-5 py-2.5"></td>
                      <td className="px-5 py-2.5 text-right text-emerald-600">{rupiah(g.subtotal.profit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile: kartu bertumpuk */}
              {g.rows.length > 0 && (
                <div className="space-y-3 p-4 md:hidden">
                  {g.rows.map((r) => (
                    <div key={r.productId} className="rounded-xl border border-slate-200 p-4">
                      <div className="font-semibold text-slate-900">{rowName(r.productId, r.name, t)}</div>
                      <div className="mt-1 flex flex-col">
                        <span className="text-[11px] text-slate-400">SKU</span>
                        <span className="font-mono text-xs text-slate-500">{r.sku}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">{t("Terjual", "Sold")}</span>
                          <span className="text-slate-600 tabular-nums">{r.terjual}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">{t("Omzet", "Revenue")}</span>
                          <span className="text-slate-600 tabular-nums">{rupiah(r.omzet)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">Fee</span>
                          <span className="text-red-500 tabular-nums">{rupiah(r.fee)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">{t("HPP/unit", "COGS/unit")}</span>
                          <span className="text-slate-400 tabular-nums">{rupiah(r.hpp)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-[11px] text-slate-400">Profit</span>
                        <span className="font-semibold text-emerald-600 tabular-nums">{rupiah(r.profit)}</span>
                      </div>
                    </div>
                  ))}

                  {/* Subtotal grup */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-semibold text-slate-700">{t(`Subtotal ${label}`, `Subtotal ${label}`)}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400">{t("Terjual", "Sold")}</span>
                        <span className="font-semibold text-slate-700 tabular-nums">{g.subtotal.terjual}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400">{t("Omzet", "Revenue")}</span>
                        <span className="font-semibold text-slate-700 tabular-nums">{rupiah(g.subtotal.omzet)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400">Fee</span>
                        <span className="font-semibold text-red-500 tabular-nums">{rupiah(g.subtotal.fee)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400">Profit</span>
                        <span className="font-semibold text-emerald-600 tabular-nums">{rupiah(g.subtotal.profit)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
