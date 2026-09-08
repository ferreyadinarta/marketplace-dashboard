import Link from "next/link";
import type { ReactNode } from "react";
import {
  TrendingUp,
  Receipt,
  Boxes,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Trophy,
  MessageCircle,
  Handshake,
  PackagePlus,
  Package,
  CalendarClock,
} from "lucide-react";
import {
  getSummary,
  getInFlight,
  getDailyTrend,
  getByMarketplace,
  getBestSellers,
  previousPeriod,
} from "@/lib/queries";
import { getStockLevels } from "@/lib/stock";
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

// Tombol aksi cepat — besar & mudah di-tap (mobile friendly).
function QuickAction({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
    >
      <span className="text-indigo-600">{icon}</span>
      {label}
    </Link>
  );
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

  const [summary, inFlight, prevSummary, trend, byMp, best, setup, levels] = await Promise.all([
    getSummary(filter),
    getInFlight(filter),
    prev ? getSummary({ ...filter, from: prev.from, to: prev.to }) : Promise.resolve(null),
    getDailyTrend(filter),
    getByMarketplace(filter),
    getBestSellers(filter, 5),
    getSetupStatus(),
    getStockLevels(),
  ]);

  // alert stok: menipis/habis + perlu opname (> 30 hari / belum pernah)
  const nowMs = Date.now();
  const lowOut = levels.filter((l) => l.status === "LOW" || l.status === "OUT").length;
  const opnameOverdue = levels.filter(
    (l) => !l.hasOpname || (l.anchorAt ? (nowMs - l.anchorAt.getTime()) / 86_400_000 > 30 : true)
  ).length;

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

      {lowOut > 0 && (
        <Link
          href="/stok?low=1"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 hover:bg-amber-100"
        >
          <Boxes size={18} className="shrink-0 text-amber-500" />
          <span className="flex-1">
            <strong>{lowOut} product</strong> stoknya menipis atau habis — cek & restock.
          </span>
          <ArrowRight size={16} />
        </Link>
      )}

      {opnameOverdue > 0 && (
        <Link
          href="/stok"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 hover:bg-amber-100"
        >
          <CalendarClock size={18} className="shrink-0 text-amber-500" />
          <span className="flex-1">
            <strong>{opnameOverdue} product</strong> perlu di-opname — hitung stok fisiknya.
          </span>
          <ArrowRight size={16} />
        </Link>
      )}

      {/* aksi cepat */}
      <Card className="p-4">
        <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Aksi Cepat</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction href="/wa" icon={<MessageCircle size={18} />} label="Penjualan WA" />
          <QuickAction href="/konsinyasi" icon={<Handshake size={18} />} label="Grosir / Reseller" />
          <QuickAction href="/stok" icon={<PackagePlus size={18} />} label="Barang Masuk" />
          <QuickAction href="/master/product" icon={<Package size={18} />} label="Tambah Product" />
        </div>
      </Card>

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

      {/* Pesanan yang belum Selesai — bukan bagian pembukuan, tapi tanpa ini
          hari-hari terakhir terlihat Rp 0 padahal penjualannya ada. */}
      {inFlight.jumlahOrder > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50/60 p-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">
              {inFlight.jumlahOrder} pesanan masih diproses · {rupiah(inFlight.omzet)}
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              Belum dihitung di angka di atas — Shopee baru menandai Selesai beberapa hari setelah
              barang sampai. Fee-nya juga belum final
              {inFlight.feeRate > 0
                ? `, perkiraan potongan ≈ ${rupiah(inFlight.perkiraanFee)} (${(inFlight.feeRate * 100).toFixed(1)}% dari riwayat).`
                : "."}
            </p>
          </div>
        </Card>
      )}

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
          <div className="hidden overflow-x-auto md:block">
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

          {/* mobile: kartu bertumpuk */}
          <div className="space-y-3 p-4 md:hidden">
            {byMp.map((m) => (
              <div key={m.marketplace} className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-bold text-slate-900">
                  {MARKETPLACE_LABEL[m.marketplace] ?? m.marketplace}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400">Order</span>
                    <span className="text-sm tabular-nums text-slate-700">{m.order.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400">Omzet</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{rupiah(m.omzet)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400">Profit</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-600">{rupiah(m.profit)}</span>
                  </div>
                </div>
              </div>
            ))}
            {byMp.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">
                Belum ada data penjualan di periode ini.
              </p>
            )}
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
