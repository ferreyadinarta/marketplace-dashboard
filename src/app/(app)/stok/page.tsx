import { Boxes, Search, PackageX, AlertTriangle, CheckCircle2, HelpCircle, CalendarClock } from "lucide-react";
import { getStockLevels, type StockStatus } from "@/lib/stock";
import { currentMonthRange } from "@/lib/format";
import { Card, CardHeader, PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { Suspense } from "react";
import { RestockForm, OpnameCell, MinStockCell, StockControls, BulkOpnamePanel } from "@/components/StockForms";
import { RememberFilters } from "@/components/RememberFilters";
import { NotificationToggle } from "@/components/NotificationToggle";
import { Pagination, PaginationControls } from "@/components/Pagination";
import { restockProducts, saveOpname, saveBulkOpname, updateMinStock } from "./actions";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

const statusMeta: Record<StockStatus, { label: string; color: "red" | "amber" | "green" | "slate" }> = {
  OUT: { label: "Habis", color: "red" },
  LOW: { label: "Menipis", color: "amber" },
  OK: { label: "Aman", color: "green" },
  UNSET: { label: "Belum opname", color: "slate" },
};

// pengingat opname: dianggap "perlu opname" kalau belum pernah opname
// atau opname terakhir lebih dari 30 hari lalu.
const OPNAME_DUE_DAYS = 30;
function opnameInfo(hasOpname: boolean, anchorAt: Date | null, now: number): { label: string; overdue: boolean } {
  if (!hasOpname || !anchorAt) return { label: "belum pernah opname", overdue: true };
  const days = Math.floor((now - anchorAt.getTime()) / 86_400_000);
  const label = days <= 0 ? "opname hari ini" : `opname ${days} hari lalu`;
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
  const overdueCount = levels.filter((l) => opnameInfo(l.hasOpname, l.anchorAt, now).overdue).length;

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
    label: `${l.name} — ${l.sku}`,
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
        title="Stok Opname"
        description="Pantau stok tiap product. Stok otomatis berkurang dari order yang Selesai (COMPLETED), bertambah dari barang masuk, dan bisa disamakan dengan hitungan fisik lewat opname."
      />

      {/* ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Boxes size={18} />} label="Total product" value={summary.total} tone="slate" />
        <StatCard icon={<AlertTriangle size={18} />} label="Stok menipis" value={summary.low} tone="amber" />
        <StatCard icon={<PackageX size={18} />} label="Stok habis" value={summary.out} tone="red" />
        <StatCard icon={<HelpCircle size={18} />} label="Belum di-opname" value={summary.unset} tone="slate" />
      </div>

      {/* notifikasi stok menipis (web push) */}
      <NotificationToggle />

      {/* pengingat opname (muncul hanya kalau ada yang perlu di-opname) */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <CalendarClock size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>{overdueCount} product</strong> perlu di-opname — belum pernah dihitung atau opname terakhir lebih
            dari {OPNAME_DUE_DAYS} hari lalu. Cek stok fisiknya lewat <strong>Opname Massal</strong> atau kolom Opname di
            bawah.
          </span>
        </div>
      )}

      {/* barang masuk */}
      <Card>
        <CardHeader title="Barang Masuk (Restock)" subtitle="Catat stok yang baru dibeli/masuk gudang." />
        <RestockForm products={productOptions} action={restockProducts} today={today} />
      </Card>

      {/* opname massal */}
      <BulkOpnamePanel items={bulkItems} action={saveBulkOpname} />

      {/* tabel stok */}
      <Card className="overflow-hidden">
        <CardHeader
          title={`Daftar Stok (${total})`}
          subtitle="Isi kolom Opname dengan hitungan fisik untuk menyamakan stok."
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
              title="Tidak ada product yang cocok"
              description="Coba ubah kata kunci atau matikan filter stok menipis."
            />
          ) : (
            <EmptyState
              icon={<Boxes size={40} />}
              title="Belum ada product"
              description="Tambahkan product dulu di Master Product, lalu stoknya bisa dihitung di sini."
              action={<LinkButton href="/master/product">Ke Master Product</LinkButton>}
            />
          )
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-full px-5 py-3 font-medium">Product</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">SKU</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Stok</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">Status</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Terjual</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">Min</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">Opname (hitung fisik)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const meta = statusMeta[l.status];
                  const info = opnameInfo(l.hasOpname, l.anchorAt, now);
                  return (
                    <tr key={l.productId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {l.name}
                        <span
                          className={`block text-[11px] font-normal ${info.overdue ? "text-amber-600" : "text-slate-400"}`}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">{l.sku}</td>
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
                        <Badge color={meta.color}>
                          {l.status === "OK" && <CheckCircle2 size={13} />}
                          {meta.label}
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
              const meta = statusMeta[l.status];
              const info = opnameInfo(l.hasOpname, l.anchorAt, now);
              return (
                <div key={l.productId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{l.name}</p>
                      <p className="font-mono text-xs text-slate-500">{l.sku}</p>
                      <p className={`text-[11px] ${info.overdue ? "text-amber-600" : "text-slate-400"}`}>{info.label}</p>
                    </div>
                    <Badge color={meta.color}>
                      {l.status === "OK" && <CheckCircle2 size={13} />}
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-400">Stok</span>
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
                      <span className="block text-[11px] text-slate-400">Terjual</span>
                      <span className="tabular-nums text-slate-600">{l.soldTotal}</span>
                      <span className="ml-1 text-xs text-slate-400">{l.unit}</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">Min. stok (alert)</span>
                      <MinStockCell productId={l.productId} minStock={l.minStock} action={updateMinStock} />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs text-slate-500">Opname (hitung fisik)</span>
                      <OpnameCell
                        productId={l.productId}
                        current={l.current}
                        known={l.status !== "UNSET"}
                        unit={l.unit}
                        packUnit={l.packUnit}
                        packSize={l.packSize}
                        action={saveOpname}
                      />
                    </div>
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
          unit="product"
        />
      </Card>
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
