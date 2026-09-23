import { CheckCircle2, AlertTriangle, Clock, Wallet, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { rupiah, MARKETPLACE_LABEL } from "@/lib/format";
import { Card, CardHeader, PageHeader, Badge, EmptyState } from "@/components/ui";
import { waktu, dateKey } from "@/lib/format";
import { SyncPayoutsButton } from "@/components/SyncPayoutsButton";
import { ManualPayoutForm } from "@/components/ManualPayoutForm";
import { ConfirmModalButton } from "@/components/ConfirmModalButton";
import { syncPayouts, addManualPayout, deletePayout } from "./actions";

export const dynamic = "force-dynamic";
// tarik pencairan bisa memakan waktu (banyak halaman escrow) → batas maksimum
export const maxDuration = 60;

// Rekonsiliasi: bandingkan net order selesai vs dana yang benar-benar cair.
export default async function RekonsiliasiPage() {
  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });
  const today = dateKey(new Date());
  // toko tanpa API → pencairannya dicatat manual (grosir/reseller, WA, dll)
  const isManual = (marketplace: string, hasToken: boolean) =>
    marketplace === "KONSINYASI" || marketplace === "WA" || !hasToken;
  const recentPayouts = await prisma.payout.findMany({
    orderBy: { payoutDate: "desc" },
    take: 12,
    include: { store: { select: { name: true } }, _count: { select: { orders: true } } },
  });

  const rows = await Promise.all(
    stores.map(async (s) => {
      // Toko API: hanya order yang escrow-nya sudah final, kalau tidak order
      // yang belum settle dihitung pakai nilai kotor → seolah dananya kurang.
      // Toko manual (grosir/WA) tidak punya escrow sama sekali, jadi semua
      // order selesai dihitung.
      const manualStore = isManual(s.marketplace, !!s.accessToken);
      const netAgg = await prisma.order.aggregate({
        where: {
          storeId: s.id,
          status: "COMPLETED",
          ...(manualStore ? {} : { escrowAt: { not: null } }),
        },
        _sum: { netAmount: true },
      });
      const payoutAgg = await prisma.payout.aggregate({
        where: { storeId: s.id },
        _sum: { amount: true },
      });
      const netSeharusnya = netAgg._sum.netAmount ?? 0;
      const danaCair = payoutAgg._sum.amount ?? 0;
      // Selisih dilihat dari sisi UANG MASUK: cair − seharusnya.
      // plus  = dana yang cair LEBIH dari perkiraan (mis. ada penyesuaian/bonus)
      // minus = masih KURANG (belum cair semua / ada potongan tak terduga)
      return { store: s, netSeharusnya, danaCair, selisih: danaCair - netSeharusnya };
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dana Cair"
        description="Cek apakah uang dari marketplace sudah masuk sesuai penjualan. Selisih minus berarti masih ada uang yang belum cair."
      />

      {stores.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={40} />}
            title="Belum ada toko"
            description="Rekonsiliasi muncul setelah ada toko Shopee terhubung dan data pencairannya ditarik."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title="Per toko"
            subtitle="Uang cair dari Shopee diambil otomatis. Toko lain: catat pembayarannya manual."
            action={<SyncPayoutsButton action={syncPayouts} />}
          />
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Toko</th>
                  <th className="px-5 py-3 text-right font-medium">Harusnya cair</th>
                  <th className="px-5 py-3 text-right font-medium">Sudah cair</th>
                  <th className="px-5 py-3 text-right font-medium">Selisih</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium" />
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
                          r.selisih === 0
                            ? "text-slate-400"
                            : r.selisih > 0
                              ? "text-emerald-600"
                              : "text-amber-600"
                        }`}
                      >
                        {r.selisih > 0 ? "+" : r.selisih < 0 ? "−" : ""}
                        {rupiah(Math.abs(r.selisih))}
                        {r.selisih !== 0 && (
                          <span className="ml-1 text-[11px] font-normal text-slate-400">
                            {r.selisih > 0 ? "lebih" : "kurang"}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {belumAdaPayout ? (
                          <Badge color="slate">
                            <Clock size={13} /> Belum ada yang cair
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
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {isManual(r.store.marketplace, !!r.store.accessToken) && (
                          <ManualPayoutForm
                            storeId={r.store.id}
                            storeName={r.store.name}
                            today={today}
                            action={addManualPayout}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {rows.map((r) => {
              const belumAdaPayout = r.danaCair === 0;
              const cocok = r.selisih === 0 && !belumAdaPayout;
              return (
                <div key={r.store.id} className="rounded-xl border border-slate-200 p-4">
                  {/* badge di baris sendiri: kalau disandingkan, teksnya pecah per kata di layar sempit */}
                  <div className="flex flex-col gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{r.store.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{MARKETPLACE_LABEL[r.store.marketplace]}</p>
                    </div>
                    <span className="self-start whitespace-nowrap">
                      {belumAdaPayout ? (
                        <Badge color="slate">
                          <Clock size={13} /> Belum ada yang cair
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
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">Harusnya cair</span>
                      <span className="font-semibold tabular-nums text-slate-600">{rupiah(r.netSeharusnya)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">Sudah cair</span>
                      <span className="font-semibold tabular-nums text-slate-600">{rupiah(r.danaCair)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">Selisih</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          r.selisih === 0
                            ? "text-slate-400"
                            : r.selisih > 0
                              ? "text-emerald-600"
                              : "text-amber-600"
                        }`}
                      >
                        {r.selisih > 0 ? "+" : r.selisih < 0 ? "−" : ""}
                        {rupiah(Math.abs(r.selisih))}
                        {r.selisih !== 0 && (
                          <span className="ml-1 text-[11px] font-normal text-slate-400">
                            {r.selisih > 0 ? "lebih" : "kurang"}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {isManual(r.store.marketplace, !!r.store.accessToken) && (
                    <div className="mt-3">
                      <ManualPayoutForm
                        storeId={r.store.id}
                        storeName={r.store.name}
                        today={today}
                        action={addManualPayout}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {recentPayouts.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Pencairan Terakhir"
            subtitle="Order yang dananya rilis di hari yang sama digabung jadi satu pencairan."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Tanggal cair</th>
                  <th className="px-5 py-3 font-medium">Toko</th>
                  <th className="px-5 py-3 text-right font-medium">Jumlah</th>
                  <th className="px-5 py-3 text-right font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Referensi</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-700">{waktu(p.payoutDate).split(",")[0]}</td>
                    <td className="px-5 py-3 text-slate-600">{p.store.name}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">{rupiah(p.amount)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{p._count.orders}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.reference ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <ConfirmModalButton
                        action={deletePayout}
                        id={p.id}
                        trigger={<Trash2 size={15} />}
                        triggerClassName="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Hapus pencairan ini?"
                        message={
                          <>
                            Pencairan <strong className="text-slate-700">{rupiah(p.amount)}</strong> untuk{" "}
                            {p.store.name} akan dihapus. Order yang tertaut jadi belum cair lagi.
                          </>
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
