import Link from "next/link";
import { Package, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct, deleteProduct, createGroup } from "./actions";
import { Card, CardHeader, PageHeader, EmptyState } from "@/components/ui";
import { ProductSearch } from "@/components/ProductControls";
import { AddProductForm, AddGroupForm } from "@/components/ProductForms";
import { ProductRow } from "@/components/EditableRows";

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
          <AddGroupForm groups={groups} action={createGroup} />
        </Card>
      </div>

      {/* tabel product */}
      <Card className="overflow-hidden">
        <CardHeader
          title={`Daftar Product (${total})`}
          subtitle="Edit HPP atau grup langsung di baris, lalu klik Update."
          action={<ProductSearch defaultValue={q} />}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-full px-5 py-3 font-medium">Product</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">SKU</th>
                  <th className="whitespace-nowrap px-5 py-3 font-medium">Ubah HPP (Modal) &amp; Grup</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-5 py-3">
                      <ProductRow
                        id={p.id}
                        name={p.name}
                        hpp={p.hpp}
                        groupId={p.groupId ?? ""}
                        groupOptions={[
                          { value: "", label: "— Tanpa grup —" },
                          ...groups.map((g) => ({ value: g.id, label: g.name })),
                        ]}
                        updateAction={updateProduct}
                        deleteAction={deleteProduct}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        {total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm sm:flex-row">
            <span className="text-slate-500">
              Menampilkan {from}–{to} dari {total} product
            </span>
            <div className="flex items-center gap-1">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ChevronLeft size={15} /> Sebelumnya
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-300">
                  <ChevronLeft size={15} /> Sebelumnya
                </span>
              )}
              <span className="px-3 text-slate-500">
                Halaman {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Berikutnya <ChevronRight size={15} />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-300">
                  Berikutnya <ChevronRight size={15} />
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
