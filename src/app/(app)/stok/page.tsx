import { Boxes, Search, PackageX, AlertTriangle, CheckCircle2, CalendarClock, ClipboardCheck } from "lucide-react";
import { getStockLevels, type StockStatus } from "@/lib/stock";
import { currentMonthRange } from "@/lib/format";
import { Card, CardHeader, PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { Suspense } from "react";
import { RestockForm, OpnameCell, MinStockCell, StockControls, BulkOpnamePanel } from "@/components/StockForms";
import { RememberFilters } from "@/components/RememberFilters";
import { NotificationToggle } from "@/components/NotificationToggle";
import { Pagination, PaginationControls } from "@/components/Pagination";
import { getT } from "@/lib/i18n-server";
import type { T } from "@/lib/i18n";
import { restockProducts, saveOpname, saveBulkOpname, updateMinStock } from "./actions";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

function statusMeta(t: T): Record<StockStatus, { label: string; color: "red" | "amber" | "green" | "slate" }> {
  return {
    OUT: { label: t("Habis", "Out of stock"), color: "red" },
    LOW: { label: t("Menipis", "Low"), color: "amber" },
    OK: { label: t("Aman", "OK"), color: "green" },
    UNSET: { label: t("Belum opname", "Not counted yet"), color: "slate" },
  };
}

// pengingat opname: dianggap "perlu opname" kalau belum pernah opname
// atau opname terakhir lebih dari 30 hari lalu.
const OPNAME_DUE_DAYS = 30;
function opnameInfo(hasOpname: boolean, anchorAt: Date | null, now: number, t: T): { label: string; overdue: boolean } {
  if (!hasOpname || !anchorAt) return { label: t("belum pernah opname", "never counted"), overdue: true };
  const days = Math.floor((now - anchorAt.getTime()) / 86_400_000);
  const label = days <= 0 ? t("opname hari ini", "counted today") : t(`opname ${days} hari lalu`, `counted ${days} day${days === 1 ? "" : "s"} ago`);
  return { label, overdue: days > OPNAME_DUE_DAYS };
}

// pecah stok satuan dasar jadi "X box + Y sachet"
function packBreakdown(current: number, packSize: number, packUnit: string, unit: string): string {
  if (packSize < 2) return "";
  const box = Math.floor(current / packSize);
  const rem = current % packSize;
  const parts: string[] = [];
  if (box > 0) parts.push(`${box} ${packUnit}`);
  if (rem > 0) parts.push(`${rem} ${unit}`);
  return "= " + (parts.join(" + ") || `0 ${unit}`);
}

export default async function StokPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (one(sp.q) ?? "").trim();
  const low = one(sp.low) === "1";
  const sort = one(sp.sort) ?? "";
  const page = Math.max(1, parseInt(one(sp.page) ?? "1", 10) || 1);

  const levels = await getStockLevels();

  // ringkasan (dari semua product, sebelum filter)
  const summary = {
    total: levels.length,
    low: levels.filter((l) => l.status === "LOW").length,
    out: levels.filter((l) => l.status === "OUT").length,
    unset: levels.filter((l) => l.status === "UNSET").length,
  };

  const now = Date.now();
  const overdueCount = levels.filter((l) => opnameInfo(l.hasOpname, l.anchorAt, now, t).overdue).length;
  const meta = statusMeta(t);

  // filter cari + stok menipis
  const ql = q.toLowerCase();
  let filtered = levels;
  if (q) filtered = filtered.filter((l) => l.name.toLowerCase().includes(ql) || l.sku.toLowerCase().includes(ql));
  if (low) filtered = filtered.filter((l) => l.status === "OUT" || l.status === "LOW");
  if (sort === "stock") {
    filtered = [...filtered].sort((a, b) => {
      const av = a.status === "UNSET" ? Infinity : a.current;
      const bv = b.status === "UNSET" ? Infinity : b.current;
      return av - bv;
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = total === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, total);

  const productOptions = levels.map((l) => ({
    value: l.productId,
    label: `${l.name} (${l.sku})`,
    unit: l.unit,
    packUnit: l.packUnit,
    packSize: l.packSize,
    koliUnit: l.koliUnit,
    koliSize: l.koliSize,
    current: l.current,
  }));
  const bulkItems = levels.map((l) => ({
    productId: l.productId,
    name: l.name,
    sku: l.sku,
    unit: l.unit,
    packUnit: l.packUnit,
    packSize: l.packSize,
    current: l.current,
    known: l.status !== "UNSET",
  }));
  const today = currentMonthRange().to;

  const pageHref = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (low) s.set("low", "1");
    if (sort) s.set("sort", sort);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return `/stok${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <RememberFilters storageKey="filters:stok" />
      </Suspense>
      <PageHeader
        title={t("Stok", "Stock")}
        description={t(
          "Stok berkurang otomatis saat order selesai dan bertambah saat kamu catat barang masuk. Opname = samakan angka di sini dengan hitungan fisik di gudang.",
          "Stock automatically decreases when an order is completed and increases when you record stock in. Stock count = match the number here with the physical count in the warehouse."
        )}
        action={
          <LinkButton href="/stok/hitung" className="w-full sm:w-auto">
            <ClipboardCheck size={16} /> {t("Hitung stok", "Count stock")}{overdueCount > 0 ? ` (${overdueCount})` : ""}
          </LinkButton>
        }
      />

      {/* ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<Boxes size={18} />} label={t("Total product", "Total products")} value={summary.total} tone="slate" />
        <StatCard icon={<AlertTriangle size={18} />} label={t("Stok menipis", "Low stock")} value={summary.low} tone="amber" />
        <StatCard icon={<PackageX size={18} />} label={t("Stok habis", "Out of stock")} value={summary.out} tone="red" />
        <StatCard
          icon={<CalendarClock size={18} />}
          label={t(`Perlu opname (>${OPNAME_DUE_DAYS} hari)`, `Needs count (>${OPNAME_DUE_DAYS} days)`)}
          value={overdueCount}
          tone={overdueCount > 0 ? "amber" : "slate"}
        />
      </div>

      {/* barang masuk */}
      <Card>
        <CardHeader title={t("Barang Masuk (Restock)", "Stock In (Restock)")} subtitle={t("Catat stok yang baru dibeli/masuk gudang.", "Record stock that was just bought or brought into the warehouse.")} />
        <RestockForm products={productOptions} action={restockProducts} today={today} />
      </Card>

      {/* opname massal — di HP diganti layar Hitung stok (daftar panjang tidak enak di layar kecil) */}
      <div className="hidden md:block">
        <BulkOpnamePanel items={bulkItems} action={saveBulkOpname} />
      </div>

      {/* tabel stok */}
      <Card className="overflow-hidden">
        <CardHeader
          title={t(`Daftar Stok (${total})`, `Stock List (${total})`)}
          subtitle={t("Angka stok menurut sistem. Hitung fisik untuk menyamakannya.", "Stock numbers according to the system. Do a physical count to match them.")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StockControls q={q} low={low} sort={sort} />
              <PaginationControls page={safePage} totalPages={totalPages} hrefFor={pageHref} />
            </div>
          }
        />

        {rows.length === 0 ? (
          q || low ? (
            <EmptyState
              icon={<Search size={40} />}
              title={t("Tidak ada product yang cocok", "No matching products")}
              description={t("Coba ubah kata kunci atau matikan filter stok menipis.", "Try changing the keyword or turning off the low-stock filter.")}
            />
          ) : (
            <EmptyState
              icon={<Boxes size={40} />}
              title={t("Belum ada product", "No products yet")}
              description={t("Tambahkan product dulu di halaman Product, lalu stoknya bisa dihitung di sini.", "Add a product on the Product page first, then its stock can be counted here.")}
              action={<LinkButton href="/master/product">{t("Ke halaman Product", "Go to Product page")}</LinkButton>}
            />
          )
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">{t("Product", "Product")}</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right font-medium">{t("Stok", "Stock")}</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">{t("Status", "Status")}</th>
                  {/* beda dengan "Terjual" di Pembukuan: di sini barang yang SUDAH KELUAR
                      gudang (terkirim + selesai), di sana yang penjualannya sudah final */}
                  <th className="whitespace-nowrap px-5 py-3 text-right font-medium">{t("Terkirim", "Shipped")}</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">{t("Batas menipis", "Low-stock threshold")}</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">{t("Hitung fisik (opname)", "Physical count (stock count)")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const rowMeta = meta[l.status];
                  const info = opnameInfo(l.hasOpname, l.anchorAt, now, t);
                  return (
                    <tr key={l.productId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="min-w-48 px-5 py-3 font-medium text-slate-900">
                        {l.name}
                        <span className="block font-mono text-[11px] font-normal text-slate-400">{l.sku}</span>
                        <span
                          className={`block text-[11px] font-normal ${info.overdue ? "text-amber-600" : "text-slate-400"}`}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {l.status === "UNSET" ? (
                          <span className="text-base font-bold text-slate-300">—</span>
                        ) : (
                          <span className="whitespace-nowrap">
                            <span
                              className={`text-base font-bold tabular-nums ${
                                l.status === "OUT"
                                  ? "text-red-600"
                                  : l.status === "LOW"
                                    ? "text-amber-600"
                                    : "text-slate-900"
                              }`}
                            >
                              {l.current}
                            </span>
                            <span className="ml-1 text-xs font-normal text-slate-400">{l.unit}</span>
                            {l.packSize > 0 && l.current > 0 && (
                              <span className="block text-[10px] text-slate-400">{packBreakdown(l.current, l.packSize, l.packUnit, l.unit)}</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <Badge color={rowMeta.color}>
                          {l.status === "OK" && <CheckCircle2 size={13} />}
                          {rowMeta.label}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-slate-500">
                        <span className="tabular-nums">{l.soldTotal}</span>
                        <span className="ml-1 text-xs text-slate-400">{l.unit}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <MinStockCell productId={l.productId} minStock={l.minStock} action={updateMinStock} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <OpnameCell
                          productId={l.productId}
                          current={l.current}
                          known={l.status !== "UNSET"}
                          unit={l.unit}
                          packUnit={l.packUnit}
                          packSize={l.packSize}
                          action={saveOpname}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* daftar stok — versi kartu untuk mobile */}
        {rows.length > 0 && (
          <div className="space-y-3 p-4 md:hidden">
            {rows.map((l) => {
              const rowMeta = meta[l.status];
              const info = opnameInfo(l.hasOpname, l.anchorAt, now, t);
              return (
                <div key={l.productId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{l.name}</p>
                      <p className="font-mono text-xs text-slate-500">{l.sku}</p>
                      <p className={`text-[11px] ${info.overdue ? "text-amber-600" : "text-slate-400"}`}>{info.label}</p>
                    </div>
                    <Badge color={rowMeta.color}>
                      {l.status === "OK" && <CheckCircle2 size={13} />}
                      {rowMeta.label}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-400">{t("Stok", "Stock")}</span>
                      {l.status === "UNSET" ? (
                        <span className="text-lg font-bold text-slate-300">—</span>
                      ) : (
                        <span>
                          <span
                            className={`text-lg font-bold tabular-nums ${
                              l.status === "OUT" ? "text-red-600" : l.status === "LOW" ? "text-amber-600" : "text-slate-900"
                            }`}
                          >
                            {l.current}
                          </span>
                          <span className="ml-1 text-xs font-normal text-slate-400">{l.unit}</span>
                          {l.packSize > 0 && l.current > 0 && (
                            <span className="block text-[10px] text-slate-400">
                              {packBreakdown(l.current, l.packSize, l.packUnit, l.unit)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] text-slate-400">{t("Terkirim", "Shipped")}</span>
                      <span className="tabular-nums text-slate-600">{l.soldTotal}</span>
                      <span className="ml-1 text-xs text-slate-400">{l.unit}</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">{t("Batas menipis", "Low-stock threshold")}</span>
                      <MinStockCell productId={l.productId} minStock={l.minStock} action={updateMinStock} />
                    </div>
                    <LinkButton
                      href={`/stok/hitung?id=${l.productId}`}
                      variant="outline"
                      className="w-full"
                    >
                      <ClipboardCheck size={16} /> {l.status === "UNSET" ? t("Hitung stok awal", "Count opening stock") : t("Hitung stok fisik", "Count physical stock")}
                    </LinkButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          hrefFor={pageHref}
          unit={t("product", "products")}
        />
      </Card>

      {/* notifikasi — setup sekali, jadi di paling bawah */}
      <NotificationToggle />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "slate" | "amber" | "red";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : tone === "red"
        ? "bg-red-50 text-red-600"
        : "bg-slate-100 text-slate-500";
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </Card>
  );
}
