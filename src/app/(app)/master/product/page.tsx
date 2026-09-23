import { Package, Search, CheckCircle, XCircle, PackageOpen, Plus } from "lucide-react";
import { Disclosure } from "@/components/Collapse";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct, deleteProduct, duplicateProduct, createGroup, deleteGroup, saveBulkPrices, deleteProducts, updateBundle } from "./actions";
import { importStoreProducts } from "../toko/import-actions";
import { Card, CardHeader, PageHeader, EmptyState } from "@/components/ui";
import { ProductSearch } from "@/components/ProductControls";
import { AddProductForm, AddGroupForm } from "@/components/ProductForms";
import { ProductRow } from "@/components/EditableRows";
import { BulkPriceForm } from "@/components/BulkPriceForm";
import { BulkDeleteProducts } from "@/components/BulkDeleteProducts";
import { SubmitButton } from "@/components/SubmitButton";
import { Pagination, PaginationControls } from "@/components/Pagination";
import { marketplaceLabel } from "@/lib/format";
import { getT } from "@/lib/i18n-server";

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
  const { t, lang } = await getT();
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
  const addStatus = one(sp.add);
  const dupeSku = one(sp.sku);
  const deletedCount = Number(one(sp.deleted) ?? 0) || 0;

  const [products, total, groups, priceRows, connectedStores, cleanupRaw] = await Promise.all([
    prisma.product.findMany({
      where,
      // bundleComponents = isi bundle (buat listing "mix": 1 box = beberapa product)
      include: { group: true, bundleComponents: { select: { componentId: true, qty: true } } },
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
        isBundle: true,
      },
    }),
    // toko marketplace yang sudah terhubung → sumber import product
    prisma.store.findMany({
      where: { marketplace: { in: ["SHOPEE", "TIKTOK"] }, accessToken: { not: null } },
      orderBy: { name: "asc" },
    }),
    // untuk panel hapus massal: sekalian hitung keterkaitannya biar aman
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        hpp: true,
        _count: { select: { orderItems: true, opnames: true, restocks: true } },
      },
    }),
  ]);

  // Bundle tidak punya HPP/stok sendiri (modalnya = jumlah isinya) → tidak ikut
  // panel isi harga massal, dan tidak bisa jadi isi bundle lain.
  const plainRows = priceRows.filter((p) => !p.isBundle);
  const unitOf = Object.fromEntries(
    priceRows.map((p) => [
      p.id,
      { unit: p.unit, packUnit: p.packUnit, packSize: p.packSize, koliUnit: p.koliUnit, koliSize: p.koliSize },
    ])
  );

  const cleanupRows = cleanupRaw.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    hpp: p.hpp,
    orderItems: p._count.orderItems,
    stockRecords: p._count.opnames + p._count.restocks,
  }));

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
        title="Product"
        description={t(
          "Semua product yang kamu jual. Isi HPP (modal) tiap product supaya profit terhitung benar.",
          "All the products you sell. Fill in the COGS for each product so profit is calculated correctly."
        )}
      />

      {/* hasil import sekarang tampil di halaman Mapping SKU (import tidak lagi
          membuat product), jadi di sini cukup notifikasi hapus & tambah. */}
      {deletedCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          <strong>{t(`${deletedCount} product dihapus.`, `${deletedCount} product${deletedCount === 1 ? "" : "s"} deleted.`)}</strong>{" "}
          {t(
            "Order yang tadinya memakai product itu jadi belum dipetakan. Atur ulang di Mapping SKU kalau perlu.",
            "Orders that used that product are now unmapped. Re-map them in SKU Mapping if needed."
          )}
        </div>
      )}
      {addStatus === "dupe" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          {t("SKU", "SKU")} <strong className="font-mono">{dupeSku}</strong>{" "}
          {t("sudah dipakai product lain. Ganti SKU yang lain.", "is already used by another product. Choose a different SKU.")}
        </div>
      )}
      {addStatus === "ok" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          {t("Product baru ditambahkan.", "New product added.")}
        </div>
      )}

      {/* form tambah — dilipat supaya daftar product langsung terlihat */}
      <Disclosure
        defaultOpen={addStatus === "dupe" || one(sp.tambah) === "1" || (total === 0 && !q)}
        icon={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Plus size={18} />
          </span>
        }
        title={t("Tambah product baru", "Add new product")}
        subtitle={t(
          "Isi nama, SKU, dan modal (HPP). Grup pembukuan diatur di sini juga.",
          "Fill in the name, SKU, and COGS. The bookkeeping group is also set here."
        )}
      >
        <div className="grid border-t border-slate-100 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AddProductForm
              groups={groups}
              action={createProduct}
              productOptions={plainRows.map((o) => ({ value: o.id, label: `${o.name} (${o.sku})` }))}
              unitOf={unitOf}
            />
          </div>
          <div className="border-t border-slate-100 lg:border-l lg:border-t-0">
            <p className="px-5 pt-5 text-sm font-semibold text-slate-900">{t("Grup pembukuan", "Bookkeeping group")}</p>
            <p className="px-5 text-xs text-slate-500">
              {t("Mengelompokkan product di halaman Pembukuan (mis. per brand).", "Groups products on the Bookkeeping page (e.g. per brand).")}
            </p>
            <AddGroupForm groups={groups} action={createGroup} deleteAction={deleteGroup} />
          </div>
        </div>
      </Disclosure>

      {/* tabel product */}
      <Card className="overflow-hidden">
        <CardHeader
          title={t(`Daftar Product (${total})`, `Product list (${total})`)}
          subtitle={t("Klik Edit di product untuk ubah HPP, harga, atau grup.", "Click Edit on a product to change its COGS, price, or group.")}
          action={
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <ProductSearch defaultValue={q} />
              <PaginationControls page={page} totalPages={totalPages} hrefFor={pageHref} />
            </div>
          }
        />
        {products.length === 0 ? (
          q ? (
            <EmptyState
              icon={<Search size={40} />}
              title={t("Tidak ada product yang cocok", "No matching products")}
              description={t(
                `Tidak ditemukan product dengan kata kunci "${q}". Coba kata kunci lain.`,
                `No products found for "${q}". Try a different search.`
              )}
            />
          ) : (
            <EmptyState
              icon={<Package size={40} />}
              title={t("Belum ada product", "No products yet")}
              description={t("Klik “Tambah product baru” di atas untuk mulai.", "Click “Add new product” above to get started.")}
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
                  { value: "", label: t("Tanpa grup", "No group") },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
                isBundle={p.isBundle}
                components={p.bundleComponents}
                // calon isi bundle: product lain yang bukan bundle
                productOptions={plainRows
                  .filter((o) => o.id !== p.id)
                  .map((o) => ({ value: o.id, label: `${o.name} (${o.sku})` }))}
                unitOf={unitOf}
                updateAction={updateProduct}
                bundleAction={updateBundle}
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
          unit={t("product", total === 1 ? "product" : "products")}
        />
      </Card>
      {/* alat massal & jarang dipakai — di bawah daftar */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("Alat lainnya", "Other tools")}</h2>
      {/* import product dari marketplace terhubung */}
        {connectedStores.length > 0 && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{t("Import Produk dari Marketplace", "Import products from marketplace")}</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {t("Tarik katalog dari toko terhubung, masuk ke", "Pull the catalog from your connected store into")}{" "}
                  <strong>{t("Mapping SKU", "SKU Mapping")}</strong>.{" "}
                  {t("Product di sini tetap product", "Products here stay your own")}{" "}
                  <strong>{t("dasar", "base")}</strong>{" "}
                  {t(
                    "buatanmu; beberapa varian marketplace (mis. “1 box” & “10 sachet”) bisa menunjuk ke satu product yang sama.",
                    "products; multiple marketplace variants (e.g. “1 box” & “10 sachets”) can point to the same product."
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {connectedStores.map((s) => (
                  <form key={s.id} action={importStoreProducts}>
                    <input type="hidden" name="storeId" value={s.id} />
                    <SubmitButton variant="outline" icon={<PackageOpen size={15} />} pendingText={t("Mengimpor…", "Importing…")} className="text-sm">
                      {s.name} ({marketplaceLabel(s.marketplace, lang)})
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* isi harga massal (HPP / retail / grosir sekaligus) */}
        <div id="isi-harga" className="scroll-mt-20">
          <BulkPriceForm products={plainRows} action={saveBulkPrices} defaultOpen={one(sp.harga) === "1"} />
        </div>

        {/* bersihkan product sampah (mis. sisa import lama) */}
        <BulkDeleteProducts products={cleanupRows} action={deleteProducts} />
      </div>
    </div>
  );
}
