import { CheckCircle2, AlertTriangle, Clock, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { rupiah, MARKETPLACE_LABEL } from "@/lib/format";
import { Card, CardHeader, PageHeader, Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

// Rekonsiliasi: bandingkan net order selesai vs dana yang benar-benar cair.
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
      return { store: s, netSeharusnya, danaCair, selisih: netSeharusnya - danaCair };
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekonsiliasi Dana"
        description="Cocokkan dana yang seharusnya cair (dari order selesai) dengan pencairan nyata dari marketplace. Selisih = perlu dicek."
      />

      {stores.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={40} />}
            title="Belum ada toko"
            description="Rekonsiliasi muncul setelah ada toko dan data pencairan dari marketplace."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title="Per Toko" subtitle="Data payout terisi otomatis lewat sync marketplace." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Toko</th>
                  <th className="px-5 py-3 text-right font-medium">Net Seharusnya</th>
                  <th className="px-5 py-3 text-right font-medium">Dana Cair</th>
                  <th className="px-5 py-3 text-right font-medium">Selisih</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const belumAdaPayout = r.danaCair === 0;
                  const cocok = r.selisih === 0 && !belumAdaPayout;
                  return (
                    <tr key={r.store.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{r.store.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{MARKETPLACE_LABEL[r.store.marketplace]}</p>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">{rupiah(r.netSeharusnya)}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{rupiah(r.danaCair)}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          r.selisih === 0 ? "text-slate-400" : "text-amber-600"
                        }`}
                      >
                        {rupiah(r.selisih)}
                      </td>
                      <td className="px-5 py-3">
                        {belumAdaPayout ? (
                          <Badge color="slate">
                            <Clock size={13} /> Payout belum masuk
                          </Badge>
                        ) : cocok ? (
                          <Badge color="green">
                            <CheckCircle2 size={13} /> Cocok
                          </Badge>
                        ) : (
                          <Badge color="amber">
                            <AlertTriangle size={13} /> Perlu dicek
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
