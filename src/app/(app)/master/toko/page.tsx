import Link from "next/link";
import { Suspense } from "react";
import { Store as StoreIcon, CheckCircle2, AlertCircle, RefreshCw, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { waktu, MARKETPLACE_LABEL } from "@/lib/format";
import { createStore, updateStoreCredentials, deleteStore } from "./actions";
import { syncTiktok } from "./tiktok-actions";
import { syncShopee } from "./shopee-actions";
import { syncAll } from "./sync-actions";
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
import { AutoSyncBanner } from "@/components/AutoSyncBanner";

export const dynamic = "force-dynamic";
// Sync toko (tarik order + escrow) jalan sebagai Server Action di halaman ini.
// Default Vercel Hobby cuma ~10 detik → naikkan ke batas maksimum 60 detik.
export const maxDuration = 60;

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
  const shopeeStatus = one(sp.shopee);
  const syncStatus = one(sp.sync);
  const reason = one(sp.reason);
  // Halaman ini khusus toko MARKETPLACE. Channel manual (Grosir/Reseller &
  // WA/Offline) dikelola di halamannya masing-masing, jadi tidak ikut dilist.
  const stores = await prisma.store.findMany({
    where: { marketplace: { notIn: ["KONSINYASI", "WA"] } },
    orderBy: { name: "asc" },
  });
  const hasConnected = stores.some(
    (s) => (s.marketplace === "TIKTOK" || s.marketplace === "SHOPEE") && !!s.accessToken
  );

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
      {shopeeStatus === "connected" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          Shopee terhubung. Klik <strong>Sync sekarang</strong> di toko-nya untuk tarik order.
        </div>
      )}
      {shopeeStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          Gagal menghubungkan Shopee: {reason ?? "unknown"}
        </div>
      )}
      {shopeeStatus === "notconfigured" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertCircle size={18} className="shrink-0 text-amber-500" />
          Kredensial Shopee belum di-set (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY).
        </div>
      )}
      {syncStatus === "ok" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          Sync selesai: {one(sp.created) ?? 0} order baru, {one(sp.updated) ?? 0} diperbarui.
        </div>
      )}
      {syncStatus === "partial" && (
        <Suspense fallback={null}>
          <AutoSyncBanner action={syncShopee} />
        </Suspense>
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
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/tiktok/authorize"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Hubungkan TikTok Shop
            </Link>
            <Link
              href="/api/shopee/authorize"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              Hubungkan Shopee
            </Link>
          </div>
        </div>
        {hasConnected && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              Tarik order terbaru dari semua toko sekaligus. Order sebenarnya masuk realtime lewat
              webhook; sync ini untuk menambal kalau ada yang terlewat.
            </p>
            <form action={syncAll}>
              <SubmitButton
                variant="outline"
                className="text-sm"
                icon={<RefreshCw size={14} />}
                pendingText="Menyinkron…"
              >
                Sync semua toko
              </SubmitButton>
            </form>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Tambah Toko Manual"
          subtitle="Untuk toko marketplace yang datanya diinput manual (belum/tidak lewat API). Toko grosir/reseller diatur di halaman Grosir / Reseller."
        />
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
            const isShopee = s.marketplace === "SHOPEE";
            const isOauth = isTiktok || isShopee;
            const connected = isOauth
              ? !!s.accessToken
              : !!s.apiKey && !!s.apiSecret && !!s.shopIdApi;
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {s.logoUrl ? (
                      // foto profil toko (dari marketplace saat authorize)
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.logoUrl}
                        alt={s.name}
                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                        <StoreIcon size={18} />
                      </div>
                    )}
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
                            {s.lastSyncAt ? `Sync: ${waktu(s.lastSyncAt)}` : "Belum pernah sync"}
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
                    {isOauth && connected && (
                      <form action={isShopee ? syncShopee : syncTiktok} className="flex items-center gap-1.5">
                        <input type="hidden" name="storeId" value={s.id} />
                        {isShopee && (
                          <select
                            name="days"
                            defaultValue="90"
                            aria-label="Rentang order yang ditarik"
                            title="Periode order yang ditarik dari Shopee"
                            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          >
                            <option value="30">30 hari</option>
                            <option value="90">90 hari</option>
                            <option value="180">6 bulan</option>
                            <option value="365">1 tahun</option>
                            <option value="730">2 tahun</option>
                            <option value="1095">3 tahun</option>
                          </select>
                        )}
                        <SubmitButton variant="outline" className="px-3 py-1.5 text-xs" icon={<RefreshCw size={14} />} pendingText="Sync…">
                          Sync sekarang
                        </SubmitButton>
                      </form>
                    )}
                    <ConfirmModalButton
                      action={deleteStore}
                      id={s.id}
                      trigger={<Trash2 size={16} />}
                      triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
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

                {/* TikTok & Shopee pakai OAuth (bukan API key manual) → tidak perlu section API.
                    Konsinyasi = manual, juga tanpa API. */}
                {!isKonsinyasi && !isOauth && (
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
