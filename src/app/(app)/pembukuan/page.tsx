import { Boxes } from "lucide-react";
import { getPembukuanByGroup, getStores, getGroups } from "@/lib/queries";
import { parseFilter, resolvePeriod } from "@/lib/parseFilter";
import { rupiah, currentMonthRange } from "@/lib/format";
import { Suspense } from "react";
import PembukuanFilter from "@/components/PembukuanFilter";
import { RememberFilters } from "@/components/RememberFilters";
import { Card, PageHeader, EmptyState, LinkButton, HelpHint } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PembukuanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

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
        title="Pembukuan"
        description="Penjualan tiap product dikelompokkan per grup. Atur rentang tanggal & marketplace, lalu export ke Excel."
      />

      <Card className="p-5">
        <PembukuanFilter stores={stores} groups={groupList} initialFrom={def.from} initialTo={def.to} />
      </Card>

      {!adaProduct ? (
        <Card>
          <EmptyState
            icon={<Boxes size={40} />}
            title="Belum ada product untuk dibukukan"
            description="Tambahkan product beserta HPP dan kelompokkan ke grup pembukuan dulu."
            action={<LinkButton href="/master/product">Ke Master Product</LinkButton>}
          />
        </Card>
      ) : (
        <>
          {/* ringkas total */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <span className="text-sm text-slate-500">Total profit bersih (sesuai filter)</span>
            <span className="text-xl font-bold text-emerald-600">{rupiah(totalProfit)}</span>
          </div>

          {groups.map((g) => (
            <Card key={g.groupId} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <h2 className="font-semibold text-slate-900">{g.groupName}</h2>
                <span className="text-sm text-slate-500">
                  Profit:{" "}
                  <span className="font-semibold text-emerald-600">{rupiah(g.subtotal.profit)}</span>
                </span>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2.5 font-medium">Product</th>
                      <th className="px-5 py-2.5 font-medium">SKU</th>
                      <th className="px-5 py-2.5 text-right font-medium">Terjual</th>
                      <th className="px-5 py-2.5 text-right font-medium">Omzet</th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        Fee<HelpHint text="Potongan marketplace, dibagi rata per item dalam order." />
                      </th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        HPP/unit<HelpHint text="Modal per satu unit product." />
                      </th>
                      <th className="px-5 py-2.5 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.productId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-5 py-2.5 font-medium text-slate-900">{r.name}</td>
                        <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{r.sku}</td>
                        <td className="px-5 py-2.5 text-right text-slate-600">{r.terjual}</td>
                        <td className="px-5 py-2.5 text-right text-slate-600">{rupiah(r.omzet)}</td>
                        <td className="px-5 py-2.5 text-right text-red-500">{rupiah(r.fee)}</td>
                        <td className="px-5 py-2.5 text-right text-slate-400">{rupiah(r.hpp)}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-emerald-600">{rupiah(r.profit)}</td>
                      </tr>
                    ))}
                    {g.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                          Belum ada product di grup ini
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                      <td className="px-5 py-2.5" colSpan={2}>
                        Subtotal {g.groupName}
                      </td>
                      <td className="px-5 py-2.5 text-right">{g.subtotal.terjual}</td>
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
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      <div className="mt-1 flex flex-col">
                        <span className="text-[11px] text-slate-400">SKU</span>
                        <span className="font-mono text-xs text-slate-500">{r.sku}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">Terjual</span>
                          <span className="text-slate-600 tabular-nums">{r.terjual}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">Omzet</span>
                          <span className="text-slate-600 tabular-nums">{rupiah(r.omzet)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">Fee</span>
                          <span className="text-red-500 tabular-nums">{rupiah(r.fee)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400">HPP/unit</span>
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
                    <div className="font-semibold text-slate-700">Subtotal {g.groupName}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400">Terjual</span>
                        <span className="font-semibold text-slate-700 tabular-nums">{g.subtotal.terjual}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400">Omzet</span>
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
          ))}
        </>
      )}
    </div>
  );
}
