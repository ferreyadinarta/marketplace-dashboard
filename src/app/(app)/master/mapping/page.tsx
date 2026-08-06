import { Link2, AlertTriangle, Search, CheckCircle, XCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_LABEL } from "@/lib/format";
import { assignMapping, bulkAssignMappings } from "./actions";
import { Card, CardHeader, PageHeader, Badge, EmptyState } from "@/components/ui";
import { MappingRow } from "@/components/EditableRows";
import { MappingFilters } from "@/components/MappingFilters";
import { BulkMappingBar } from "@/components/BulkMappingBar";
import { Pagination, PaginationControls } from "@/components/Pagination";
import { suggestProduct } from "@/lib/suggestMapping";

export const dynamic = "force-dynamic";

const PER_PAGE = 15;

export default async function MappingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q);
  const status = one(sp.status); // "" | "unmapped" | "mapped"
  const marketplace = one(sp.marketplace);
  const storeId = one(sp.storeId);
  const page = Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);

  // Halaman ini khusus SKU MARKETPLACE. Toko Grosir/Reseller & WA dikelola di
  // halamannya sendiri dan tidak punya SKU marketplace → jangan ikut terdaftar.
  const MP_ONLY = { marketplace: { notIn: ["KONSINYASI", "WA"] } };

  const where: Prisma.ProductMappingWhereInput = { store: MP_ONLY };
  if (status === "unmapped") where.productId = null;
  if (status === "mapped") where.productId = { not: null };
  if (storeId) where.storeId = storeId;
  if (marketplace) where.store = { marketplace };
  if (q) {
    where.OR = [
      { marketplaceSku: { contains: q, mode: "insensitive" } },
      { marketplaceProductName: { contains: q, mode: "insensitive" } },
    ];
  }

  // cakupan tombol massal = filter yang sama, TAPI selalu hanya yang belum
  // dipetakan (status di filter tidak ikut supaya "semua yang tampil" konsisten)
  const bulkWhere: Prisma.ProductMappingWhereInput = { ...where, productId: null };

  const [mappings, total, totalUnmapped, products, stores] = await Promise.all([
    prisma.productMapping.findMany({
      where,
      include: { store: true, product: true },
      orderBy: [{ productId: "asc" }, { marketplaceSku: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.productMapping.count({ where }),
    prisma.productMapping.count({ where: { productId: null, store: MP_ONLY } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    // filter toko = toko MARKETPLACE saja (sama seperti Master Toko).
    // Grosir/Reseller & WA tidak punya SKU marketplace, jadi tak ada gunanya di sini.
    prisma.store.findMany({
      where: { marketplace: { notIn: ["KONSINYASI", "WA"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // untuk tombol massal: semua baris belum dipetakan di filter ini (bukan cuma
  // halaman ini) — cuma nama yang diambil, jadi ringan walau ribuan baris
  const unmappedRows = await prisma.productMapping.findMany({
    where: bulkWhere,
    select: { marketplaceProductName: true, marketplaceSku: true },
    take: 3_000,
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const fromRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const toRow = Math.min(page * PER_PAGE, total);
  const anyFilter = !!(q || status || marketplace || storeId);

  const pageHref = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (status) s.set("status", status);
    if (marketplace) s.set("marketplace", marketplace);
    if (storeId) s.set("storeId", storeId);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return `/master/mapping${qs ? `?${qs}` : ""}`;
  };

  const productOptions = [
    { value: "", label: "— Belum dipetakan —" },
    ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
  ];

  // Saran otomatis untuk baris yang belum dipetakan: tebak product dasar dari
  // nama listing + isi per unit dari teks variannya. User tetap yang memutuskan.
  const lite = products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, packSize: p.packSize, isBundle: p.isBundle }));
  const suggestions = new Map<string, ReturnType<typeof suggestProduct>>();
  for (const m of mappings) {
    if (m.productId) continue;
    suggestions.set(m.id, suggestProduct(m.marketplaceProductName || m.marketplaceSku, lite));
  }
  // satuan tiap product (koli/box/sachet) → dipakai toggle satuan di kolom isi
  const unitInfo = Object.fromEntries(
    products.map((p) => [
      p.id,
      {
        unit: p.unit,
        packUnit: p.packUnit,
        packSize: p.packSize,
        koliUnit: p.koliUnit,
        koliSize: p.koliSize,
      },
    ])
  );

  // berapa banyak dari baris belum dipetakan itu yang punya saran cukup yakin
  const suggestable = unmappedRows.filter(
    (r) => !!suggestProduct(r.marketplaceProductName || r.marketplaceSku, lite)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapping SKU"
        description="Satu product bisa punya SKU berbeda di tiap marketplace. Hubungkan tiap SKU ke product internal supaya penjualannya masuk pembukuan."
      />

      {one(sp.import) === "ok" && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" />
          <span>
            Import selesai: <strong>{one(sp.created) || 0} SKU baru</strong>, {one(sp.existing) || 0} sudah ada
            {Number(one(sp.nosku) || 0) > 0 ? `, ${one(sp.nosku)} dilewati (tanpa SKU)` : ""}. Pilih product
            dasarnya di bawah — pakai tombol <strong>Saran</strong> kalau cocok.
          </span>
        </div>
      )}
      {one(sp.import) === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          Import gagal: {one(sp.reason) || "unknown"}
        </div>
      )}

      {totalUnmapped > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>{totalUnmapped} SKU belum dipetakan.</strong> Penjualannya belum dihitung sampai dipetakan.
            Kolom <strong>isi</strong> = berapa satuan dasar untuk 1 unit yang dijual (mis. varian “1 box” →
            isi 16), supaya stok & profit-nya benar.
          </span>
        </div>
      )}

      {one(sp.bulk) === "ok" && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" />
          <span>
            <strong>{one(sp.n) || 0} SKU dipetakan.</strong> Order lama ikut diperbarui — pembukuan & stok
            sudah menyesuaikan.
            {Number(one(sp.skip) || 0) > 0
              ? ` ${one(sp.skip)} SKU dilewati (tidak ada saran yang cukup yakin).`
              : ""}
          </span>
        </div>
      )}
      {one(sp.bulk) === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          Gagal memetakan massal: {one(sp.reason) || "unknown"}
        </div>
      )}

      <Card className="p-5">
        <MappingFilters stores={stores} />
      </Card>

      <BulkMappingBar
        action={bulkAssignMappings}
        unmappedInFilter={unmappedRows.length}
        suggestable={suggestable}
        options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
        filters={{ q, marketplace, storeId }}
        isFiltered={!!(q || marketplace || storeId)}
      />

      <Card className="overflow-hidden">
        <CardHeader
          title={`SKU Marketplace (${total})`}
          subtitle="Baris kuning = belum dipetakan."
          action={<PaginationControls page={page} totalPages={totalPages} hrefFor={pageHref} />}
        />
        {mappings.length === 0 ? (
          anyFilter ? (
            <EmptyState
              icon={<Search size={40} />}
              title="Tidak ada SKU yang cocok"
              description="Coba ubah atau reset filter di atas."
            />
          ) : (
            <EmptyState
              icon={<Link2 size={40} />}
              title="Belum ada SKU"
              description="Daftar SKU terisi otomatis saat order pertama masuk dari sync marketplace."
            />
          )
        ) : (
          // SKU marketplace sengaja TIDAK jadi kolom sendiri: kodenya (mis.
          // SHP-1739…-1764…) tidak informatif buat user. Tetap disimpan &
          // ditampilkan kecil karena itu kunci pencocokan order dari Shopee.
          <div className="hidden md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[13%] px-5 py-3 font-medium">Toko</th>
                  <th className="w-[45%] px-5 py-3 font-medium">Product di Marketplace</th>
                  <th className="w-[42%] px-5 py-3 font-medium">Product Internal (punya kamu)</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-b border-slate-50 last:border-0 ${
                      !m.productId ? "bg-amber-50/50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-5 py-3 align-top">
                      <Badge color="slate">{MARKETPLACE_LABEL[m.store.marketplace]}</Badge>
                      <p className="mt-1 truncate text-xs text-slate-400">{m.store.name}</p>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <p className="text-slate-700">{m.marketplaceProductName}</p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-300" title={m.marketplaceSku}>
                        {m.marketplaceSku}
                      </p>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <MappingRow
                        mappingId={m.id}
                        initialProductId={m.productId ?? ""}
                        initialBaseQty={m.baseQtyPerUnit}
                        unitInfo={unitInfo}
                        suggestion={suggestions.get(m.id) ?? null}
                        action={assignMapping}
                        options={productOptions}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {mappings.length > 0 && (
          <div className="space-y-3 p-4 md:hidden">
            {mappings.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border border-slate-200 p-4 ${
                  !m.productId ? "bg-amber-50/50" : ""
                }`}
              >
                {/* nama product yang dipentingkan, bukan kode SKU marketplace */}
                <p className="text-sm font-semibold text-slate-900">{m.marketplaceProductName}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-300">{m.marketplaceSku}</p>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400">Toko</span>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge color="slate">{MARKETPLACE_LABEL[m.store.marketplace]}</Badge>
                      <span className="text-sm text-slate-600">{m.store.name}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400">Product Internal (punya kamu)</span>
                    <div className="mt-1">
                      <MappingRow
                        mappingId={m.id}
                        initialProductId={m.productId ?? ""}
                        initialBaseQty={m.baseQtyPerUnit}
                        unitInfo={unitInfo}
                        suggestion={suggestions.get(m.id) ?? null}
                        action={assignMapping}
                        options={productOptions}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          from={fromRow}
          to={toRow}
          hrefFor={pageHref}
          unit="SKU"
        />
      </Card>
    </div>
  );
}
