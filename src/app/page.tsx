import { getSummary, getDailyTrend, getByMarketplace } from "@/lib/queries";
import { rupiah, MARKETPLACE_LABEL } from "@/lib/format";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, trend, byMp] = await Promise.all([
    getSummary({}),
    getDailyTrend({}),
    getByMarketplace({}),
  ]);

  const margin = summary.omzet ? (summary.profit / summary.omzet) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">Ringkasan seluruh toko & marketplace</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Omzet" value={summary.omzet} accent="blue" />
        <StatCard label="Fee Marketplace" value={summary.fee} accent="red" />
        <StatCard label="Total HPP (Modal)" value={summary.hpp} accent="amber" />
        <StatCard
          label="Profit Bersih"
          value={summary.profit}
          accent="green"
          hint={`Margin ${margin.toFixed(1)}% · ${summary.jumlahOrder.toLocaleString("id-ID")} order`}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Tren Omzet & Profit Harian</h2>
        <TrendChart data={trend} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Performa per Marketplace</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="pb-2">Marketplace</th>
              <th className="pb-2 text-right">Order</th>
              <th className="pb-2 text-right">Omzet</th>
              <th className="pb-2 text-right">Profit</th>
              <th className="pb-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {byMp.map((m) => (
              <tr key={m.marketplace} className="border-b border-slate-100">
                <td className="py-2 font-medium">{MARKETPLACE_LABEL[m.marketplace] ?? m.marketplace}</td>
                <td className="py-2 text-right">{m.order.toLocaleString("id-ID")}</td>
                <td className="py-2 text-right">{rupiah(m.omzet)}</td>
                <td className="py-2 text-right text-emerald-600">{rupiah(m.profit)}</td>
                <td className="py-2 text-right text-slate-500">
                  {m.omzet ? ((m.profit / m.omzet) * 100).toFixed(1) : "0"}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
