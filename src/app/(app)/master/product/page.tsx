import { Package, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct, deleteProduct, duplicateProduct, createGroup, deleteGroup } from "./actions";
import { Card, CardHeader, PageHeader, EmptyState } from "@/components/ui";
import { ProductSearch } from "@/components/ProductControls";
import { AddProductForm, AddGroupForm } from "@/components/ProductForms";
import { ProductRow } from "@/components/EditableRows";
import { Pagination, PaginationControls } from "@/components/Pagination";

export const dynamic = "force-dynamic";

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

  const [products, total, groups] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { group: true },
      orderBy: { name: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
    prisma.bookkeepingGroup.findMany({ orderBy: { name: "asc" } }),
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
