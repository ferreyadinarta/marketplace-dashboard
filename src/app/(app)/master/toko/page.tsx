import Link from "next/link";
import { Store as StoreIcon, CheckCircle2, AlertCircle, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { tanggal, MARKETPLACE_LABEL } from "@/lib/format";
import { createStore, updateStoreCredentials, deleteStore } from "./actions";
import { syncTiktok } from "./tiktok-actions";
import {
  Card,
  CardHeader,
  PageHeader,
  Field,
  inputClass,
  Checkbox,
  Badge,
  EmptyState,
} from "@/components/ui";
import { AddStoreForm, AdvancedApiSection } from "@/components/StoreForms";
import { ConfirmModalButton } from "@/components/ConfirmModalButton";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const mpColor: Record<string, "amber" | "slate" | "green"> = {
  SHOPEE: "amber",
  TIKTOK: "slate",
  TOKOPEDIA: "green",
};

export default async function MasterTokoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tiktokStatus = one(sp.tiktok);
  const syncStatus = one(sp.sync);
  const reason = one(sp.reason);
  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Toko"
        description="Daftarkan tiap toko: cukup isi nama & pilih marketplace-nya. Pengaturan API (opsional) ada di bagian lanjutan tiap toko."
      />

      {/* hasil connect / sync */}
      {tiktokStatus === "connected" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          TikTok Shop terhubung ({one(sp.n) ?? 0} toko). Klik <strong>Sync sekarang</strong> di toko-nya untuk tarik order.
        </div>
      )}
      {tiktokStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          Gagal menghubungkan TikTok: {reason ?? "unknown"}
        </div>
      )}
      {syncStatus === "ok" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          Sync selesai: {one(sp.created) ?? 0} order baru, {one(sp.updated) ?? 0} diperbarui.
        </div>
      )}
      {syncStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          Sync gagal: {reason ?? "unknown"}
        </div>
      )}

      {/* Hubungkan marketplace via API (TikTok/Tokopedia) */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Hubungkan Marketplace Otomatis</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Sambungkan TikTok Shop (& Tokopedia) untuk tarik order otomatis. Kamu akan diarahkan ke
              halaman izin — login pakai akun seller yang punya toko.
            </p>
          </div>
          <Link
            href="/api/tiktok/authorize"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Hubungkan TikTok Shop
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tambah Toko Manual" subtitle="Untuk toko yang tidak lewat API (mis. konsinyasi)." />
        <AddStoreForm action={createStore} />
      </Card>

      {stores.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StoreIcon size={40} />}
            title="Belum ada toko"
            description="Tambahkan toko pertama lewat form di atas."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {stores.map((s) => {
            const isKonsinyasi = s.marketplace === "KONSINYASI" || s.marketplace === "WA";
            const isTiktok = s.marketplace === "TIKTOK";
            const connected = isTiktok
              ? !!s.accessToken
              : !!s.apiKey && !!s.apiSecret && !!s.shopIdApi;
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <StoreIcon size={18} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">{s.name}</h2>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge color={mpColor[s.marketplace] ?? "slate"}>
                          {MARKETPLACE_LABEL[s.marketplace] ?? s.marketplace}
                        </Badge>
                        {isKonsinyasi ? (
                          <span className="text-xs text-slate-400">Input manual (tanpa API)</span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {s.lastSyncAt ? `Sync: ${tanggal(s.lastSyncAt)}` : "Belum pernah sync"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isKonsinyasi &&
                      (connected ? (
                        <Badge color="green">
                          <CheckCircle2 size={13} /> Terhubung
                        </Badge>
                      ) : (
                        <Badge color="amber">
                          <AlertCircle size={13} /> Belum terhubung
                        </Badge>
                      ))}
                    {isTiktok && connected && (
                      <form action={syncTiktok}>
                        <input type="hidden" name="storeId" value={s.id} />
                        <SubmitButton variant="outline" className="px-3 py-1.5 text-xs" icon={<RefreshCw size={14} />} pendingText="Sync…">
                          Sync sekarang
                        </SubmitButton>
                      </form>
                    )}
                    <ConfirmModalButton
                      action={deleteStore}
                      id={s.id}
                      trigger="Hapus"
                      triggerClassName="text-xs font-medium text-red-500 hover:underline"
                      title="Hapus toko ini?"
                      message={
                        <>
                          <span className="font-medium text-slate-700">{s.name}</span> beserta semua data
                          order/penjualannya akan dihapus permanen.
                        </>
                      }
                    />
                  </div>
                </div>

                {/* TikTok pakai OAuth (bukan API key manual) → tidak perlu section API.
                    Konsinyasi = manual, juga tanpa API. */}
                {!isKonsinyasi && !isTiktok && (
                  <div>
                    <AdvancedApiSection connected={connected}>
                      <form action={updateStoreCredentials} className="grid gap-3 sm:grid-cols-3">
                        <input type="hidden" name="id" value={s.id} />
                        <Field label="API Key">
                          <input
                            name="apiKey"
                            defaultValue={s.apiKey ?? ""}
                            placeholder="dari developer marketplace"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="API Secret">
                          <input
                            name="apiSecret"
                            defaultValue={s.apiSecret ?? ""}
                            placeholder="rahasia, jangan dibagikan"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Shop ID" hint="ID toko di sisi marketplace, biasanya angka.">
                          <input
                            name="shopIdApi"
                            defaultValue={s.shopIdApi ?? ""}
                            placeholder="ex: 1029384756"
                            className={inputClass}
                          />
                        </Field>
                        <div className="flex items-center">
                          <Checkbox name="isActive" defaultChecked={s.isActive} label="Toko aktif (ikut sync)" />
                        </div>
                        <div className="sm:col-span-2 sm:flex sm:justify-end">
                          <SubmitButton variant="outline" pendingText="Menyimpan…">
                            Simpan Kredensial
                          </SubmitButton>
                        </div>
                      </form>
                    </AdvancedApiSection>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
