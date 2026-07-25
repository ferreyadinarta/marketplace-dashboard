import { prisma } from "@/lib/prisma";
import { MARKETPLACE_LABEL } from "@/lib/format";
import { assignMapping } from "./actions";

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const [mappings, products] = await Promise.all([
    prisma.productMapping.findMany({
      include: { store: true, product: true },
      orderBy: [{ productId: "asc" }, { marketplaceSku: "asc" }],
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);

  const unmapped = mappings.filter((m) => !m.productId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mapping SKU</h1>
        <p className="text-sm text-slate-500">
          Hubungkan SKU dari tiap marketplace ke product internal. SKU yang belum dipetakan tidak masuk pembukuan.
        </p>
      </div>

      {unmapped.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <strong>{unmapped.length} SKU belum ter-mapping.</strong> Petakan agar penjualannya masuk pembukuan.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-5 py-2">Toko</th>
              <th className="px-5 py-2">SKU Marketplace</th>
              <th className="px-5 py-2">Nama di Marketplace</th>
              <th className="px-5 py-2">Product Internal</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.id} className={`border-b border-slate-100 ${!m.productId ? "bg-amber-50/40" : ""}`}>
                <td className="px-5 py-2">
                  <span className="text-slate-500">{MARKETPLACE_LABEL[m.store.marketplace]}</span>
                  <br />
                  <span className="text-xs text-slate-400">{m.store.name}</span>
                </td>
                <td className="px-5 py-2 font-mono text-xs">{m.marketplaceSku}</td>
                <td className="px-5 py-2 text-slate-600">{m.marketplaceProductName}</td>
                <td className="px-5 py-2">
                  <form action={assignMapping} className="flex items-center gap-2">
                    <input type="hidden" name="mappingId" value={m.id} />
                    <select name="productId" defaultValue={m.productId ?? ""} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                      <option value="">— Belum dipetakan —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                    <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-100">
                      Simpan
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                  Belum ada SKU. Mapping terisi otomatis saat order pertama masuk dari sync.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
