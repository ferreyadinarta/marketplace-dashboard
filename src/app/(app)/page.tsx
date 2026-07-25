import Link from "next/link";
import { TrendingUp, Receipt, Boxes, Wallet, AlertTriangle, ArrowRight, Trophy } from "lucide-react";
import {
  getSummary,
  getDailyTrend,
  getByMarketplace,
  getBestSellers,
  previousPeriod,
} from "@/lib/queries";
import { getSetupStatus } from "@/lib/setupStatus";
import { parseFilter, resolvePeriod } from "@/lib/parseFilter";
import { rupiah, currentMonthRange, MARKETPLACE_LABEL } from "@/lib/format";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";
import SetupChecklist from "@/components/SetupChecklist";
import DateRangePicker from "@/components/DateRangePicker";
import DashboardRefresh from "@/components/DashboardRefresh";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const def = currentMonthRange();
  const filter = parseFilter({ ...sp, from: period.from, to: period.to });

  // periode pembanding (hanya kalau bukan "semua data")
  const canCompare = !period.isAll && !!filter.from && !!filter.to;
  const prev = canCompare ? previousPeriod(filter.from!, filter.to!) : null;

  const [summary, prevSummary, trend, byMp, best, setup] = await Promise.all([
    getSummary(filter),
    prev ? getSummary({ ...filter, from: prev.from, to: prev.to }) : Promise.resolve(null),
    getDailyTrend(filter),
    getByMarketplace(filter),
    getBestSellers(filter, 5),
    getSetupStatus(),
  ]);

  const margin = summary.omzet ? (summary.profit / summary.omzet) * 100 : 0;
  const dOmzet = prevSummary ? pct(summary.omzet, prevSummary.omzet) : null;
  const dProfit = prevSummary ? pct(summary.profit, prevSummary.profit) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan penjualan & profit dari seluruh toko dan marketplace."
        action={<DateRangePicker initialFrom={def.from} initialTo={def.to} basePath="/" />}
      />
      <DashboardRefresh />

      {!setup.complete && (
        <SetupChecklist steps={setup.steps} doneCount={setup.doneCount} total={setup.total} />
      )}

      {setup.unmappedCount > 0 && (
        <Link
          href="/master/mapping"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 hover:bg-amber-100"
        >
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <span className="flex-1">
            <strong>{setup.unmappedCount} SKU belum dipetakan</strong> — penjualannya belum masuk pembukuan.
          </span>
          <ArrowRight size={16} />
        </Link>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Omzet"
          value={summary.omzet}
          icon={<TrendingUp size={18} />}
          accent="blue"
          deltaPct={dOmzet}
          hint={canCompare ? "vs periode sebelumnya" : undefined}
          help="Total penjualan (yang dibayar pembeli) dari semua order, sebelum dipotong biaya apa pun."
        />
        <StatCard
          label="Fee Marketplace"
          value={summary.fee}
          icon={<Receipt size={18} />}
          accent="red"
          help="Total potongan/komisi yang diambil marketplace."
        />
        <StatCard
          label="Total HPP"
          value={summary.hpp}
          icon={<Boxes size={18} />}
          accent="amber"
          help="Harga Pokok Penjualan = total modal semua product yang terjual."
        />
        <StatCard
          label="Profit Bersih"
          value={summary.profit}
          icon={<Wallet size={18} />}
          accent="green"
          deltaPct={dProfit}
          hint={`Margin ${margin.toFixed(1)}% · ${summary.jumlahOrder.toLocaleString("id-ID")} order`}
          help="Omzet dikurangi fee marketplace dan HPP. Inilah untung sebenarnya."
        />
      </div>

      {/* chart */}
      <Card>
        <CardHeader title="Tren Omzet & Profit Harian" subtitle="Sesuai periode terpilih" />
        <div className="p-5">
          {trend.length > 0 ? (
            <TrendChart data={trend} />
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">
              Belum ada data order di periode ini.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* per marketplace */}
        <Card>
          <CardHeader title="Performa per Marketplace" subtitle="Kontribusi tiap platform" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Marketplace</th>
                  <th className="px-5 py-3 text-right font-medium">Order</th>
                  <th className="px-5 py-3 text-right font-medium">Omzet</th>
                  <th className="px-5 py-3 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {byMp.map((m) => (
                  <tr key={m.marketplace} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {MARKETPLACE_LABEL[m.marketplace] ?? m.marketplace}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{m.order.toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{rupiah(m.omzet)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-600">{rupiah(m.profit)}</td>
                  </tr>
                ))}
                {byMp.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                      Belum ada data penjualan di periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* best sellers */}
        <Card>
          <CardHeader
            title="Product Terlaris"
            subtitle="Top 5 penyumbang profit di periode ini"
            action={<Trophy size={18} className="text-amber-500" />}
          />
          <div className="divide-y divide-slate-50">
            {best.map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.qty.toLocaleString("id-ID")} terjual</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-emerald-600">{rupiah(p.profit)}</span>
              </div>
            ))}
            {best.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                Belum ada penjualan product di periode ini.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
