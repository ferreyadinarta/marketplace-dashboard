import { Plus, FolderPlus, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct, deleteProduct, createGroup } from "./actions";
import { Card, CardHeader, PageHeader, Button, Field, inputClass, Select, Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MasterProductPage() {
  const [products, groups] = await Promise.all([
    prisma.product.findMany({ include: { group: true }, orderBy: { name: "asc" } }),
    prisma.bookkeepingGroup.findMany({ orderBy: { name: "asc" } }),
  ]);

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
          <form action={createProduct} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nama product">
              <input name="name" placeholder="mis. Flimty Fiber Blackcurrant" required className={inputClass} />
            </Field>
            <Field label="SKU internal" hint="Kode unik product versi kamu sendiri, bukan SKU marketplace.">
              <input name="sku" placeholder="mis. FLM-FIBER-BC" required className={inputClass} />
            </Field>
            <Field label="HPP / Modal (Rp)" hint="Harga Pokok Penjualan: modal untuk 1 unit product.">
              <input name="hpp" type="number" min="0" placeholder="0" className={inputClass} />
            </Field>
            <Field label="Grup pembukuan">
              <Select
                name="groupId"
                placeholder="— Tanpa grup —"
                options={[
                  { value: "", label: "— Tanpa grup —" },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button variant="primary">
                <Plus size={16} /> Simpan Product
              </Button>
            </div>
          </form>
        </Card>

        {/* form tambah grup */}
        <Card className="self-start">
          <CardHeader title="Grup Pembukuan" subtitle="Kelompok untuk tabel pembukuan." />
          <form action={createGroup} className="space-y-4 p-5">
            <Field label="Nama grup">
              <input name="name" placeholder="mis. Flimty" required className={inputClass} />
            </Field>
            <Button variant="outline">
              <FolderPlus size={16} /> Tambah Grup
            </Button>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {groups.length ? (
                groups.map((g) => <Badge key={g.id} color="brand">{g.name}</Badge>)
              ) : (
                <span className="text-xs text-slate-400">Belum ada grup</span>
              )}
            </div>
          </form>
        </Card>
      </div>

      {/* tabel product */}
      <Card className="overflow-hidden">
        <CardHeader title={`Daftar Product (${products.length})`} subtitle="Edit HPP atau grup langsung di baris, lalu klik Update." />
        {products.length === 0 ? (
          <EmptyState
            icon={<Package size={40} />}
            title="Belum ada product"
            description="Tambahkan product pertama lewat form di atas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Ubah HPP (Modal) &amp; Grup</th>
                  <th className="px-5 py-3 text-right font-medium">Hapus</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-5 py-3">
                      <form action={updateProduct} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <span className="flex flex-col">
                          <span className="mb-1 text-[11px] font-medium text-slate-400">HPP (Rp)</span>
                          <input
                            name="hpp"
                            type="number"
                            min="0"
                            defaultValue={p.hpp}
                            className="h-9 w-32 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          />
                        </span>
                        <span className="flex flex-col">
                          <span className="mb-1 text-[11px] font-medium text-slate-400">Grup</span>
                          <Select
                            name="groupId"
                            defaultValue={p.groupId ?? ""}
                            placeholder="— Tanpa grup —"
                            className="h-9 min-w-40 py-0"
                            options={[
                              { value: "", label: "— Tanpa grup —" },
                              ...groups.map((g) => ({ value: g.id, label: g.name })),
                            ]}
                          />
                        </span>
                        <button className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100">
                          Update
                        </button>
                      </form>
                    </td>
                    <td className="px-5 py-3 text-right align-bottom">
                      <form action={deleteProduct} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50">
                          Hapus
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
