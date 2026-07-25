import { getPembukuanByGroup, getStores } from "@/lib/queries";
import { parseFilter } from "@/lib/parseFilter";
import { rupiah } from "@/lib/format";
import PembukuanFilter from "@/components/PembukuanFilter";

export const dynamic = "force-dynamic";

export default async function PembukuanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filter = parseFilter(sp);
  const [groups, stores] = await Promise.all([getPembukuanByGroup(filter), getStores()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pembukuan</h1>
        <p className="text-sm text-slate-500">Product dikelompokkan per grup. Filter & export sesuai kebutuhan.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <PembukuanFilter stores={stores} />
      </div>

      {groups.map((g) => (
        <div key={g.groupId} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="font-semibold">{g.groupName}</h2>
            <span className="text-sm text-slate-500">
              Profit grup: <span className="font-semibold text-emerald-600">{rupiah(g.subtotal.profit)}</span>
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-5 py-2">Product</th>
                <th className="px-5 py-2">SKU</th>
                <th className="px-5 py-2 text-right">Terjual</th>
                <th className="px-5 py-2 text-right">Omzet</th>
                <th className="px-5 py-2 text-right">Fee</th>
                <th className="px-5 py-2 text-right">HPP/unit</th>
                <th className="px-5 py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.productId} className="border-b border-slate-100">
                  <td className="px-5 py-2 font-medium">{r.name}</td>
                  <td className="px-5 py-2 text-slate-500">{r.sku}</td>
                  <td className="px-5 py-2 text-right">{r.terjual}</td>
                  <td className="px-5 py-2 text-right">{rupiah(r.omzet)}</td>
                  <td className="px-5 py-2 text-right text-red-500">{rupiah(r.fee)}</td>
                  <td className="px-5 py-2 text-right text-slate-500">{rupiah(r.hpp)}</td>
                  <td className="px-5 py-2 text-right font-semibold text-emerald-600">{rupiah(r.profit)}</td>
                </tr>
              ))}
              {g.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-4 text-center text-slate-400">
                    Belum ada product di grup ini
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-5 py-2" colSpan={2}>
                  Subtotal {g.groupName}
                </td>
                <td className="px-5 py-2 text-right">{g.subtotal.terjual}</td>
                <td className="px-5 py-2 text-right">{rupiah(g.subtotal.omzet)}</td>
                <td className="px-5 py-2 text-right text-red-500">{rupiah(g.subtotal.fee)}</td>
                <td className="px-5 py-2"></td>
                <td className="px-5 py-2 text-right text-emerald-600">{rupiah(g.subtotal.profit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}
