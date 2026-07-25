import { prisma } from "@/lib/prisma";
import { rupiah, MARKETPLACE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

// Rekonsiliasi: bandingkan net order selesai vs dana yang benar-benar cair.
// Selisih = potensi fee tak terduga / dana belum cair / kesalahan marketplace.
export default async function RekonsiliasiPage() {
  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });

  const rows = await Promise.all(
    stores.map(async (s) => {
      const netAgg = await prisma.order.aggregate({
        where: { storeId: s.id, status: "COMPLETED" },
        _sum: { netAmount: true },
      });
      const payoutAgg = await prisma.payout.aggregate({
        where: { storeId: s.id },
        _sum: { amount: true },
      });
      const netSeharusnya = netAgg._sum.netAmount ?? 0;
      const danaCair = payoutAgg._sum.amount ?? 0;
      return {
        store: s,
        netSeharusnya,
        danaCair,
        selisih: netSeharusnya - danaCair,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rekonsiliasi Dana</h1>
        <p className="text-sm text-slate-500">
          Bandingkan dana yang seharusnya cair (dari order selesai) vs pencairan nyata dari marketplace.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-5 py-2">Toko</th>
              <th className="px-5 py-2 text-right">Net Seharusnya Cair</th>
              <th className="px-5 py-2 text-right">Dana Cair (Payout)</th>
              <th className="px-5 py-2 text-right">Selisih</th>
              <th className="px-5 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const belumAdaPayout = r.danaCair === 0;
              const cocok = r.selisih === 0 && !belumAdaPayout;
              return (
                <tr key={r.store.id} className="border-b border-slate-100">
                  <td className="px-5 py-2">
                    <span className="font-medium">{r.store.name}</span>
                    <br />
                    <span className="text-xs text-slate-400">{MARKETPLACE_LABEL[r.store.marketplace]}</span>
                  </td>
                  <td className="px-5 py-2 text-right">{rupiah(r.netSeharusnya)}</td>
                  <td className="px-5 py-2 text-right">{rupiah(r.danaCair)}</td>
                  <td className={`px-5 py-2 text-right font-semibold ${r.selisih === 0 ? "text-slate-500" : "text-amber-600"}`}>
                    {rupiah(r.selisih)}
                  </td>
                  <td className="px-5 py-2">
                    {belumAdaPayout ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Data payout belum masuk</span>
                    ) : cocok ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Cocok</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Perlu dicek</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Data payout terisi otomatis lewat adapter <code>fetchPayouts()</code> tiap marketplace saat sync aktif.
      </p>
    </div>
  );
}
