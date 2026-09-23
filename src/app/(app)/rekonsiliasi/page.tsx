import { CheckCircle2, AlertTriangle, Clock, Wallet, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { rupiah, marketplaceLabel } from "@/lib/format";
import { Card, CardHeader, PageHeader, Badge, EmptyState } from "@/components/ui";
import { waktu, dateKey } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { SyncPayoutsButton } from "@/components/SyncPayoutsButton";
import { ManualPayoutForm } from "@/components/ManualPayoutForm";
import { ConfirmModalButton } from "@/components/ConfirmModalButton";
import { syncPayouts, addManualPayout, deletePayout } from "./actions";

export const dynamic = "force-dynamic";
// tarik pencairan bisa memakan waktu (banyak halaman escrow) → batas maksimum
export const maxDuration = 60;

// Rekonsiliasi: bandingkan net order selesai vs dana yang benar-benar cair.
export default async function RekonsiliasiPage() {
  const { t, lang } = await getT();
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
        title={t("Dana Cair", "Payouts")}
        description={t(
          "Cek apakah uang dari marketplace sudah masuk sesuai penjualan. Selisih minus berarti masih ada uang yang belum cair.",
          "Check whether the money from marketplaces has come in as expected. A negative difference means some money hasn't been paid out yet."
        )}
      />

      {stores.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={40} />}
            title={t("Belum ada toko", "No stores yet")}
            description={t(
              "Rekonsiliasi muncul setelah ada toko Shopee terhubung dan data pencairannya ditarik.",
              "Reconciliation appears once a Shopee store is connected and its payout data has been pulled."
            )}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={t("Per toko", "Per store")}
            subtitle={t(
              "Uang cair dari Shopee diambil otomatis. Toko lain: catat pembayarannya manual.",
              "Money paid out from Shopee is pulled automatically. Other stores: record payments manually."
            )}
            action={<SyncPayoutsButton action={syncPayouts} />}
          />
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">{t("Toko", "Store")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Harusnya cair", "Expected")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Sudah cair", "Received")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Selisih", "Difference")}</th>
                  <th className="px-5 py-3 font-medium">{t("Status", "Status")}</th>
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
                        <p className="mt-0.5 text-xs text-slate-400">{marketplaceLabel(r.store.marketplace, lang)}</p>
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
                            {r.selisih > 0 ? t("lebih", "more") : t("kurang", "less")}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {belumAdaPayout ? (
                          <Badge color="slate">
                            <Clock size={13} /> {t("Belum ada yang cair", "Nothing paid out yet")}
                          </Badge>
                        ) : cocok ? (
                          <Badge color="green">
                            <CheckCircle2 size={13} /> {t("Cocok", "Matches")}
                          </Badge>
                        ) : (
                          <Badge color="amber">
                            <AlertTriangle size={13} /> {t("Perlu dicek", "Needs attention")}
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
                      <p className="mt-0.5 text-xs text-slate-400">{marketplaceLabel(r.store.marketplace, lang)}</p>
                    </div>
                    <span className="self-start whitespace-nowrap">
                      {belumAdaPayout ? (
                        <Badge color="slate">
                          <Clock size={13} /> {t("Belum ada yang cair", "Nothing paid out yet")}
                        </Badge>
                      ) : cocok ? (
                        <Badge color="green">
                          <CheckCircle2 size={13} /> {t("Cocok", "Matches")}
                        </Badge>
                      ) : (
                        <Badge color="amber">
                          <AlertTriangle size={13} /> {t("Perlu dicek", "Needs attention")}
                        </Badge>
                      )}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">{t("Harusnya cair", "Expected")}</span>
                      <span className="font-semibold tabular-nums text-slate-600">{rupiah(r.netSeharusnya)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">{t("Sudah cair", "Received")}</span>
                      <span className="font-semibold tabular-nums text-slate-600">{rupiah(r.danaCair)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">{t("Selisih", "Difference")}</span>
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
                            {r.selisih > 0 ? t("lebih", "more") : t("kurang", "less")}
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
            title={t("Pencairan Terakhir", "Recent Payouts")}
            subtitle={t(
              "Order yang dananya rilis di hari yang sama digabung jadi satu pencairan.",
              "Orders whose funds are released on the same day are grouped into one payout."
            )}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">{t("Tanggal cair", "Payout date")}</th>
                  <th className="px-5 py-3 font-medium">{t("Toko", "Store")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Jumlah", "Amount")}</th>
                  <th className="px-5 py-3 text-right font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">{t("Referensi", "Reference")}</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-700">{waktu(p.payoutDate, lang).split(",")[0]}</td>
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
                        title={t("Hapus pencairan ini?", "Delete this payout?")}
                        message={
                          <>
                            {t("Pencairan ", "Payout ")}
                            <strong className="text-slate-700">{rupiah(p.amount)}</strong>
                            {t(" untuk ", " for ")}
                            {p.store.name}
                            {t(
                              " akan dihapus. Order yang tertaut jadi belum cair lagi.",
                              " will be deleted. Linked orders go back to not paid out."
                            )}
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
