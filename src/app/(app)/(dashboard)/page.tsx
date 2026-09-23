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
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { enGB, id as localeId } from "date-fns/locale";
import { getSetupStatus } from "@/lib/setupStatus";
import { parseFilter, resolvePeriod } from "@/lib/parseFilter";
import { rupiah, currentMonthRange, marketplaceLabel } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";
import SetupChecklist from "@/components/SetupChecklist";
import DateRangePicker from "@/components/DateRangePicker";
import DashboardRefresh from "@/components/DashboardRefresh";
import { Card, CardHeader, PageHeader, HelpHint } from "@/components/ui";

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
  const { t, lang } = await getT();
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const def = currentMonthRange();
  const filter = parseFilter({ ...sp, from: period.from, to: period.to });

  // periode pembanding (hanya kalau bukan "semua data")
  const canCompare = !period.isAll && !!filter.from && !!filter.to;
  const prev = canCompare ? previousPeriod(filter.from!, filter.to!) : null;

  const [summary, inFlight, prevSummary, trend, byMp, best, setup, levels, lastSync] = await Promise.all([
    getSummary(filter),
    getInFlight(filter),
    prev ? getSummary({ ...filter, from: prev.from, to: prev.to }) : Promise.resolve(null),
    getDailyTrend(filter),
    getByMarketplace(filter),
    getBestSellers(filter, 5),
    getSetupStatus(t),
    getStockLevels(),
    // sync terakhir dari toko yang terhubung API (toko manual tidak di-sync)
    prisma.store.aggregate({ _max: { lastSyncAt: true }, where: { accessToken: { not: null } } }),
  ]);

  // alert stok: menipis/habis + perlu opname (> 30 hari / belum pernah)
  const nowMs = Date.now();
  const lowOut = levels.filter((l) => l.status === "LOW" || l.status === "OUT").length;
  const opnameOverdue = levels.filter(
    (l) => !l.hasOpname || (l.anchorAt ? (nowMs - l.anchorAt.getTime()) / 86_400_000 > 30 : true)
  ).length;

  const todos = [
    setup.unmappedCount > 0 && {
      href: "/master/mapping",
      icon: <AlertTriangle size={18} />,
      title: t(
        `${setup.unmappedCount} SKU belum dipetakan`,
        `${setup.unmappedCount} unmapped ${setup.unmappedCount === 1 ? "SKU" : "SKUs"}`
      ),
      detail: t(
        "Penjualannya belum masuk pembukuan.",
        "Sales for these aren't recorded in bookkeeping yet."
      ),
    },
    lowOut > 0 && {
      href: "/stok?low=1",
      icon: <Boxes size={18} />,
      title: t(
        `${lowOut} product hampir/sudah habis`,
        `${lowOut} ${lowOut === 1 ? "product is" : "products are"} low or out of stock`
      ),
      detail: t("Waktunya restock.", "Time to restock."),
    },
    opnameOverdue > 0 && {
      href: "/stok/hitung",
      icon: <CalendarClock size={18} />,
      title: t(
        `${opnameOverdue} product belum dihitung ulang`,
        `${opnameOverdue} ${opnameOverdue === 1 ? "product hasn't" : "products haven't"} been recounted`
      ),
      detail: t("Cek stok fisiknya di gudang.", "Check physical stock in the warehouse."),
    },
  ].filter(Boolean) as { href: string; icon: ReactNode; title: string; detail: string }[];

  // tren kosong = semua hari 0 → jangan gambar garis datar yang terlihat rusak
  const hasTrend = trend.some((pt) => pt.omzet !== 0 || pt.profit !== 0);

  const margin = summary.omzet ? (summary.profit / summary.omzet) * 100 : 0;
  // tanpa order selesai di periode ini, "−100%" cuma menakut-nakuti → sembunyikan
  const hasOrders = summary.jumlahOrder > 0;
  const dOmzet = prevSummary && hasOrders ? pct(summary.omzet, prevSummary.omzet) : null;
  const dProfit = prevSummary && hasOrders ? pct(summary.profit, prevSummary.profit) : null;

  const syncedAt = lastSync._max.lastSyncAt;
  const syncStale = syncedAt ? nowMs - syncedAt.getTime() > 86_400_000 : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={t(
          "Ringkasan penjualan & profit dari seluruh toko dan marketplace.",
          "Summary of sales & profit across all stores and marketplaces."
        )}
        action={<DateRangePicker initialFrom={def.from} initialTo={def.to} basePath="/" />}
      />
      <DashboardRefresh />
      {syncedAt && (
        <p className={`-mt-3 text-xs ${syncStale ? "text-amber-700" : "text-slate-400"}`}>
          {t("Data marketplace diperbarui", "Marketplace data updated")}{" "}
          {formatDistanceToNow(syncedAt, { addSuffix: true, locale: lang === "en" ? enGB : localeId })}
          {syncStale && (
            <>
              {". "}
              {t("Sudah lebih dari sehari.", "It's been more than a day.")}{" "}
              <Link href="/master/toko" className="font-medium underline">
                {t("Cek sync", "Check sync")}
              </Link>
            </>
          )}
        </p>
      )}

      {!setup.complete && (
        <SetupChecklist steps={setup.steps} doneCount={setup.doneCount} total={setup.total} />
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("Omzet", "Revenue")}
          value={summary.omzet}
          icon={<TrendingUp size={18} />}
          accent="blue"
          deltaPct={dOmzet}
          hint={
            !hasOrders
              ? t("Belum ada order selesai", "No completed orders yet")
              : canCompare
                ? t("vs periode sebelumnya", "vs previous period")
                : undefined
          }
          help={t(
            "Total penjualan (yang dibayar pembeli) dari semua order, sebelum dipotong biaya apa pun.",
            "Total sales (paid by buyers) from all orders, before any costs are deducted."
          )}
        />
        <StatCard
          label={t("Fee Marketplace", "Marketplace Fees")}
          value={summary.fee}
          icon={<Receipt size={18} />}
          accent="red"
          help={t("Total potongan/komisi yang diambil marketplace.", "Total fees/commission taken by the marketplace.")}
        />
        <StatCard
          label={t("Total HPP", "Total COGS")}
          value={summary.hpp}
          icon={<Boxes size={18} />}
          accent="amber"
          help={t(
            "Harga Pokok Penjualan = total modal semua product yang terjual.",
            "Cost of goods sold = total cost of all products sold."
          )}
        />
        <StatCard
          label={
            summary.hpp === 0 && summary.omzet > 0
              ? t("Profit (belum ada HPP)", "Profit (no COGS yet)")
              : t("Profit Bersih", "Net Profit")
          }
          value={summary.profit}
          icon={<Wallet size={18} />}
          accent={summary.hpp === 0 && summary.omzet > 0 ? "amber" : "green"}
          deltaPct={dProfit}
          hint={
            summary.hpp === 0 && summary.omzet > 0
              ? t(
                  `Baru omzet − fee · ${summary.jumlahOrder.toLocaleString("id-ID")} order`,
                  `Revenue minus fees only · ${summary.jumlahOrder.toLocaleString("id-ID")} orders`
                )
              : t(
                  `Margin ${margin.toFixed(1)}% · ${summary.jumlahOrder.toLocaleString("id-ID")} order`,
                  `Margin ${margin.toFixed(1)}% · ${summary.jumlahOrder.toLocaleString("id-ID")} orders`
                )
          }
          help={
            summary.hpp === 0 && summary.omzet > 0
              ? t(
                  "HPP semua product masih 0, jadi angka ini baru omzet dikurangi fee marketplace, BUKAN untung sebenarnya. Isi HPP di halaman Product supaya profit & margin benar.",
                  "COGS for all products is still 0, so this number is only revenue minus marketplace fees, not actual profit. Fill in COGS on the Product page so profit & margin are correct."
                )
              : t(
                  "Omzet dikurangi fee marketplace dan HPP. Inilah untung sebenarnya.",
                  "Revenue minus marketplace fees and COGS. This is the actual profit."
                )
          }
        />
      </div>

      {/* hal yang perlu ditindak — satu kartu, bukan banner bertumpuk */}
      {todos.length > 0 && (
        <Card className="overflow-hidden border-amber-200">
          <p className="border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-900">
            {t("Perlu dicek", "Needs attention")}
          </p>
          <div className="divide-y divide-slate-100">
            {todos.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-5 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="shrink-0 text-amber-500">{item.icon}</span>
                <span className="flex-1">
                  <strong className="font-semibold text-slate-900">{item.title}.</strong> {item.detail}
                </span>
                <ArrowRight size={16} className="shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* aksi cepat */}
      <Card className="p-4">
        <p className="mb-3 px-1 text-sm font-semibold text-slate-900">{t("Catat cepat", "Quick actions")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction href="/wa" icon={<MessageCircle size={18} />} label={t("Penjualan WA", "WA Sales")} />
          <QuickAction
            href="/konsinyasi"
            icon={<Handshake size={18} />}
            label={t("Grosir / Reseller", "Wholesale / Reseller")}
          />
          <QuickAction href="/stok" icon={<PackagePlus size={18} />} label={t("Barang Masuk", "Stock In")} />
          <QuickAction href="/master/product" icon={<Package size={18} />} label={t("Tambah Product", "Add Product")} />
        </div>
      </Card>

      {/* Pesanan yang belum Selesai — bukan bagian pembukuan, tapi tanpa ini
          hari-hari terakhir terlihat Rp 0 padahal penjualannya ada. */}
      {inFlight.jumlahOrder > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50/60 p-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">
              {t(
                `${inFlight.jumlahOrder} pesanan belum selesai`,
                `${inFlight.jumlahOrder} ${inFlight.jumlahOrder === 1 ? "order" : "orders"} not yet completed`
              )}{" "}
              · {rupiah(inFlight.omzet)}
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              {t(
                "Belum masuk angka di atas. Marketplace baru menandai Selesai beberapa hari setelah barang sampai.",
                "Not included in the numbers above. Marketplaces only mark orders Completed a few days after the item arrives."
              )}
            </p>
            {inFlight.sampel > 0 && (
              <p className="mt-1 flex items-center text-xs text-amber-800/80">
                {t("Perkiraan uang yang nanti masuk:", "Estimated amount to be received:")}&nbsp;
                <strong className="font-semibold">±{rupiah(inFlight.perkiraanBersih)}</strong>
                <HelpHint
                  text={t(
                    `Dihitung dari pola 90 hari terakhir (${inFlight.sampel} pesanan selesai): ±${(inFlight.batalRate * 100).toFixed(0)}% batal, potongan ±${(inFlight.feeRate * 100).toFixed(1)}%. Perkiraan, bukan angka pembukuan.`,
                    `Calculated from the last 90 days' pattern (${inFlight.sampel} completed orders): ±${(inFlight.batalRate * 100).toFixed(0)}% cancelled, ±${(inFlight.feeRate * 100).toFixed(1)}% fees. An estimate, not a bookkeeping figure.`
                  )}
                />
              </p>
            )}
          </div>
        </Card>
      )}

      {/* chart */}
      <Card>
        <CardHeader
          title={t("Tren Omzet & Profit Harian", "Daily Revenue & Profit Trend")}
          subtitle={t("Sesuai periode terpilih", "For the selected period")}
        />
        <div className="p-5">
          {hasTrend ? (
            <TrendChart data={trend} />
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">
              {t("Belum ada data order di periode ini.", "No order data for this period yet.")}
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* per marketplace */}
        <Card>
          <CardHeader
            title={t("Performa per Marketplace", "Performance per Marketplace")}
            subtitle={t("Kontribusi tiap platform", "Contribution per platform")}
          />
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Marketplace</th>
                  <th className="px-5 py-3 text-right font-medium">Order</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Omzet", "Revenue")}</th>
                  <th className="px-5 py-3 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {byMp.map((m) => (
                  <tr key={m.marketplace} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {marketplaceLabel(m.marketplace, lang)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{m.order.toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{rupiah(m.omzet)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-600">{rupiah(m.profit)}</td>
                  </tr>
                ))}
                {byMp.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                      {t("Belum ada data penjualan di periode ini.", "No sales data for this period yet.")}
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
                <p className="mb-3 flex items-baseline justify-between text-sm font-bold text-slate-900">
                  {marketplaceLabel(m.marketplace, lang)}
                  <span className="text-xs font-normal text-slate-400">
                    {m.order.toLocaleString("id-ID")} {t("order", m.order === 1 ? "order" : "orders")}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">{t("Omzet", "Revenue")}</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{rupiah(m.omzet)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Profit</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-600">{rupiah(m.profit)}</span>
                  </div>
                </div>
              </div>
            ))}
            {byMp.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">
                {t("Belum ada data penjualan di periode ini.", "No sales data for this period yet.")}
              </p>
            )}
          </div>
        </Card>

        {/* best sellers */}
        <Card>
          <CardHeader
            title={t("Product Terlaris", "Top Products")}
            subtitle={t("Top 5 penyumbang profit di periode ini", "Top 5 profit contributors for this period")}
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
                  <p className="text-xs text-slate-400">
                    {p.qty.toLocaleString("id-ID")} {t("terjual", "sold")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-emerald-600">{rupiah(p.profit)}</span>
              </div>
            ))}
            {best.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                {t("Belum ada penjualan product di periode ini.", "No product sales for this period yet.")}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
