import { Package, Search, CheckCircle, XCircle, PackageOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct, deleteProduct, duplicateProduct, createGroup, deleteGroup, saveBulkPrices } from "./actions";
import { importStoreProducts } from "../toko/import-actions";
import { Card, CardHeader, PageHeader, EmptyState } from "@/components/ui";
import { ProductSearch } from "@/components/ProductControls";
import { AddProductForm, AddGroupForm } from "@/components/ProductForms";
import { ProductRow } from "@/components/EditableRows";
import { BulkPriceForm } from "@/components/BulkPriceForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Pagination, PaginationControls } from "@/components/Pagination";
import { MARKETPLACE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
// Import katalog marketplace jalan sebagai Server Action di halaman ini dan bisa
// lama untuk toko dengan banyak product → pakai batas maksimum Vercel Hobby.
export const maxDuration = 60;

const PER_PAGE = 10;

export default async function MasterProductPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const page = Math.max(1, parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) ?? "1", 10) || 1);

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { sku: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const importStatus = one(sp.import);
  const reason = one(sp.reason);
  const addStatus = one(sp.add);
  const dupeSku = one(sp.sku);

  const [products, total, groups, priceRows, connectedStores] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { group: true },
      orderBy: { name: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
    prisma.bookkeepingGroup.findMany({ orderBy: { name: "asc" } }),
    // semua product (untuk panel isi harga massal)
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, sku: true, hpp: true, priceRetail: true, priceGrosir: true,
        unit: true, packUnit: true, packSize: true, koliUnit: true, koliSize: true,
      },
    }),
    // toko marketplace yang sudah terhubung → sumber import product
    prisma.store.findMany({
      where: { marketplace: { in: ["SHOPEE", "TIKTOK"] }, accessToken: { not: null } },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  const pageHref = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return `/master/product${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Product"
        description="Daftar product beserta HPP (modal) dan grup pembukuannya. HPP dipakai untuk menghitung profit."
      />

      {importStatus === "ok" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          Import selesai: <strong>{one(sp.created) ?? 0} product baru</strong>, {one(sp.existing) ?? 0} sudah ada
          {Number(one(sp.nosku) ?? 0) > 0 ? `, ${one(sp.nosku)} dilewati (tanpa SKU)` : ""}. Lengkapi HPP-nya
          lewat “Isi Harga Massal” di bawah.
        </div>
      )}
      {importStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          Import gagal: {reason ?? "unknown"}
        </div>
      )}
      {addStatus === "dupe" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          SKU <strong className="font-mono">{dupeSku}</strong> sudah dipakai product lain. Ganti SKU yang lain.
        </div>
      )}
      {addStatus === "ok" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          Product baru ditambahkan.
        </div>
      )}

      {/* import product dari marketplace terhubung */}
      {connectedStores.length > 0 && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Import Produk dari Marketplace</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Tarik katalog dari toko terhubung → jadi Master Product otomatis. Product yang SKU-nya sudah ada
                tidak diubah (HPP/harga manual aman).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {connectedStores.map((s) => (
                <form key={s.id} action={importStoreProducts}>
                  <input type="hidden" name="storeId" value={s.id} />
                  <SubmitButton variant="outline" icon={<PackageOpen size={15} />} pendingText="Import…" className="text-sm">
                    {s.name} ({MARKETPLACE_LABEL[s.marketplace] ?? s.marketplace})
                  </SubmitButton>
                </form>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* isi harga massal (HPP / retail / grosir sekaligus) */}
      <BulkPriceForm products={priceRows} action={saveBulkPrices} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* form tambah product */}
        <Card className="lg:col-span-2">
          <CardHeader title="Tambah Product" subtitle="SKU internal harus unik antar product." />
          <AddProductForm groups={groups} action={createProduct} />
        </Card>

        {/* form tambah grup */}
        <Card>
          <CardHeader title="Grup Pembukuan" subtitle="Kelompok untuk tabel pembukuan." />
          <AddGroupForm groups={groups} action={createGroup} deleteAction={deleteGroup} />
        </Card>
      </div>

      {/* tabel product */}
      <Card className="overflow-hidden">
        <CardHeader
          title={`Daftar Product (${total})`}
          subtitle="Edit HPP atau grup langsung di baris, lalu klik Update."
          action={
            <div className="flex items-center gap-2">
              <ProductSearch defaultValue={q} />
              <PaginationControls page={page} totalPages={totalPages} hrefFor={pageHref} />
            </div>
          }
        />
        {products.length === 0 ? (
          q ? (
            <EmptyState
              icon={<Search size={40} />}
              title="Tidak ada product yang cocok"
              description={`Tidak ditemukan product dengan kata kunci "${q}". Coba kata kunci lain.`}
            />
          ) : (
            <EmptyState
              icon={<Package size={40} />}
              title="Belum ada product"
              description="Tambahkan product pertama lewat form di atas."
            />
          )
        ) : (
          <div className="space-y-3 p-5">
            {products.map((p) => (
              <ProductRow
                key={p.id}
                id={p.id}
                name={p.name}
                sku={p.sku}
                hpp={p.hpp}
                priceRetail={p.priceRetail}
                priceGrosir={p.priceGrosir}
                unit={p.unit}
                packUnit={p.packUnit}
                packSize={p.packSize}
                koliUnit={p.koliUnit}
                koliSize={p.koliSize}
                groupId={p.groupId ?? ""}
                groupName={p.group?.name}
                groupOptions={[
                  { value: "", label: "— Tanpa grup —" },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
                updateAction={updateProduct}
                deleteAction={deleteProduct}
                duplicateAction={duplicateProduct}
              />
            ))}
          </div>
        )}

        <Pagination
          page={page}
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
