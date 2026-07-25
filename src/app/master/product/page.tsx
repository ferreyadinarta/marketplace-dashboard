import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/format";
import { createProduct, updateProduct, deleteProduct, createGroup } from "./actions";

export const dynamic = "force-dynamic";

export default async function MasterProductPage() {
  const [products, groups] = await Promise.all([
    prisma.product.findMany({ include: { group: true }, orderBy: { name: "asc" } }),
    prisma.bookkeepingGroup.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master Product</h1>
        <p className="text-sm text-slate-500">Atur product, HPP (modal), dan grup pembukuan.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* form tambah product */}
        <form action={createProduct} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Tambah Product</h2>
          <input name="name" placeholder="Nama product" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="sku" placeholder="SKU internal (unik)" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="hpp" type="number" placeholder="HPP / modal (Rp)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="groupId" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— Tanpa grup —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Simpan Product
          </button>
        </form>

        {/* form tambah grup */}
        <form action={createGroup} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 self-start">
          <h2 className="text-sm font-semibold">Tambah Grup Pembukuan</h2>
          <input name="name" placeholder="Nama grup (mis. Skincare)" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Simpan Grup
          </button>
          <p className="text-xs text-slate-400">Grup saat ini: {groups.map((g) => g.name).join(", ") || "belum ada"}</p>
        </form>
      </div>

      {/* tabel product */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-5 py-2">Product</th>
              <th className="px-5 py-2">SKU</th>
              <th className="px-5 py-2">HPP & Grup</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 align-middle">
                <td className="px-5 py-2 font-medium">{p.name}</td>
                <td className="px-5 py-2 text-slate-500">{p.sku}</td>
                <td className="px-5 py-2">
                  <form action={updateProduct} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="hpp" type="number" defaultValue={p.hpp} className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                    <select name="groupId" defaultValue={p.groupId ?? ""} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                      <option value="">— Tanpa grup —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-100">
                      Update
                    </button>
                  </form>
                </td>
                <td className="px-5 py-2 text-right">
                  <span className="mr-3 text-xs text-slate-400">{rupiah(p.hpp)}</span>
                  <form action={deleteProduct} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-xs text-red-500 hover:underline">Hapus</button>
                  </form>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-400">Belum ada product</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
