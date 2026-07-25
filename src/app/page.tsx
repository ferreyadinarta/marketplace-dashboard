import Link from "next/link";
import { TrendingUp, Receipt, Boxes, Wallet, AlertTriangle, ArrowRight } from "lucide-react";
import { getSummary, getDailyTrend, getByMarketplace } from "@/lib/queries";
import { getSetupStatus } from "@/lib/setupStatus";
import { rupiah, MARKETPLACE_LABEL } from "@/lib/format";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";
import SetupChecklist from "@/components/SetupChecklist";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, trend, byMp, setup] = await Promise.all([
    getSummary({}),
    getDailyTrend({}),
    getByMarketplace({}),
    getSetupStatus(),
  ]);

  const margin = summary.omzet ? (summary.profit / summary.omzet) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan penjualan & profit dari seluruh toko dan marketplace."
      />

      {/* onboarding — tampil sampai semua langkah selesai */}
      {!setup.complete && (
        <SetupChecklist steps={setup.steps} doneCount={setup.doneCount} total={setup.total} />
      )}

      {/* alert SKU belum mapping */}
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
          hint={`Margin ${margin.toFixed(1)}% · ${summary.jumlahOrder.toLocaleString("id-ID")} order`}
          help="Omzet dikurangi fee marketplace dan HPP."
        />
      </div>

      {/* chart */}
      <Card>
        <CardHeader title="Tren Omzet & Profit Harian" subtitle="90 hari terakhir" />
        <div className="p-5">
          {trend.length > 0 ? (
            <TrendChart data={trend} />
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">
              Belum ada data order. Data muncul setelah sync marketplace aktif.
            </p>
          )}
        </div>
      </Card>

      {/* per marketplace */}
      <Card>
        <CardHeader
          title="Performa per Marketplace"
          subtitle="Bandingkan kontribusi tiap platform"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Marketplace</th>
                <th className="px-5 py-3 text-right font-medium">Order</th>
                <th className="px-5 py-3 text-right font-medium">Omzet</th>
                <th className="px-5 py-3 text-right font-medium">Profit</th>
                <th className="px-5 py-3 text-right font-medium">Margin</th>
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
                  <td className="px-5 py-3 text-right">
                    <Badge color={m.profit > 0 ? "green" : "slate"}>
                      {m.omzet ? ((m.profit / m.omzet) * 100).toFixed(1) : "0"}%
                    </Badge>
                  </td>
                </tr>
              ))}
              {byMp.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    Belum ada data penjualan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
