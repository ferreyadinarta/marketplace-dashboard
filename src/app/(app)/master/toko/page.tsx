import Link from "next/link";
import { Store as StoreIcon, CheckCircle2, AlertCircle, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { waktu, marketplaceLabel } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { createStore, updateStoreCredentials, deleteStore } from "./actions";
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
import { SyncProgressPanel } from "@/components/SyncProgressPanel";
import { SyncAllButton, StoreSyncButton } from "@/components/SyncButtons";

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
  const { t, lang } = await getT();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tiktokStatus = one(sp.tiktok);
  const shopeeStatus = one(sp.shopee);
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
        title={t("Toko", "Stores")}
        description={t(
          "Daftarkan tiap toko: cukup isi nama & pilih marketplace-nya. Pengaturan API (opsional) ada di bagian lanjutan tiap toko.",
          "Register each store: just fill in the name & pick its marketplace. API settings (optional) are in the advanced section of each store."
        )}
      />

      {/* progres sync yang sedang jalan (polling) — termasuk sync dari cron/tab lain */}
      <SyncProgressPanel />

      {/* hasil connect / sync */}
      {tiktokStatus === "connected" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          {t(
            `TikTok Shop terhubung (${one(sp.n) ?? 0} toko). Klik `,
            `TikTok Shop connected (${one(sp.n) ?? 0} stores). Click `
          )}
          <strong>{t("Sync sekarang", "Sync now")}</strong>
          {t(" di toko-nya untuk tarik order.", " on the store to pull orders.")}
        </div>
      )}
      {tiktokStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          {t("Gagal menghubungkan TikTok: ", "Failed to connect TikTok: ")}
          {reason ?? "unknown"}
        </div>
      )}
      {shopeeStatus === "connected" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle size={18} className="shrink-0 text-emerald-500" />
          {t("Shopee terhubung. Klik ", "Shopee connected. Click ")}
          <strong>{t("Sync sekarang", "Sync now")}</strong>
          {t(" di toko-nya untuk tarik order.", " on the store to pull orders.")}
        </div>
      )}
      {shopeeStatus === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={18} className="shrink-0 text-red-500" />
          {t("Gagal menghubungkan Shopee: ", "Failed to connect Shopee: ")}
          {reason ?? "unknown"}
        </div>
      )}
      {shopeeStatus === "notconfigured" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertCircle size={18} className="shrink-0 text-amber-500" />
          {t(
            "Kredensial Shopee belum di-set (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY).",
            "Shopee credentials aren't set yet (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY)."
          )}
        </div>
      )}

      {/* Hubungkan marketplace via API (TikTok/Tokopedia) */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {t("Hubungkan Marketplace Otomatis", "Connect Marketplace Automatically")}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {t(
                "Sambungkan akun seller supaya order masuk otomatis. Kamu akan diarahkan ke halaman login marketplace.",
                "Connect your seller account so orders come in automatically. You'll be redirected to the marketplace login page."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/tiktok/authorize"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              {t("Hubungkan TikTok Shop", "Connect TikTok Shop")}
            </Link>
            <Link
              href="/api/shopee/authorize"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              {t("Hubungkan Shopee", "Connect Shopee")}
            </Link>
          </div>
        </div>
        {hasConnected && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {t(
                "Tarik order terbaru dari semua toko sekaligus. Order sebenarnya masuk realtime lewat webhook; sync ini untuk menambal kalau ada yang terlewat.",
                "Pull the latest orders from all stores at once. Orders actually come in real time via webhook; this sync is to catch anything that was missed."
              )}
            </p>
            <SyncAllButton />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={t("Tambah Toko Manual", "Add Store Manually")}
          subtitle={t(
            "Untuk toko marketplace yang datanya diinput manual (belum/tidak lewat API). Toko grosir/reseller diatur di halaman Grosir / Reseller.",
            "For marketplace stores whose data is entered manually (not via API). Wholesale/reseller stores are managed on the Wholesale / Reseller page."
          )}
        />
        <AddStoreForm action={createStore} />
      </Card>

      {stores.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StoreIcon size={40} />}
            title={t("Belum ada toko", "No stores yet")}
            description={t("Tambahkan toko pertama lewat form di atas.", "Add your first store using the form above.")}
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
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
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
                          {marketplaceLabel(s.marketplace, lang)}
                        </Badge>
                        {isKonsinyasi ? (
                          <span className="text-xs text-slate-400">
                            {t("Input manual (tanpa API)", "Manual input (no API)")}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {s.lastSyncAt
                              ? `${t("Sync", "Sync")}: ${waktu(s.lastSyncAt, lang)}`
                              : t("Belum pernah sync", "Never synced")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isKonsinyasi &&
                      (connected ? (
                        <Badge color="green">
                          <CheckCircle2 size={13} /> {t("Terhubung", "Connected")}
                        </Badge>
                      ) : (
                        <Badge color="amber">
                          <AlertCircle size={13} /> {t("Belum terhubung", "Not connected")}
                        </Badge>
                      ))}
                    {isOauth && connected && <StoreSyncButton storeId={s.id} isShopee={isShopee} />}
                    <ConfirmModalButton
                      action={deleteStore}
                      id={s.id}
                      trigger={<Trash2 size={16} />}
                      triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title={t("Hapus toko ini?", "Delete this store?")}
                      message={
                        <>
                          <span className="font-medium text-slate-700">{s.name}</span>{" "}
                          {t(
                            "beserta semua data order/penjualannya akan dihapus permanen.",
                            "and all its order/sales data will be permanently deleted."
                          )}
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
                            placeholder={t("dari developer marketplace", "from the marketplace developer console")}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="API Secret">
                          <input
                            name="apiSecret"
                            defaultValue={s.apiSecret ?? ""}
                            placeholder={t("rahasia, jangan dibagikan", "secret, don't share it")}
                            className={inputClass}
                          />
                        </Field>
                        <Field
                          label="Shop ID"
                          hint={t("ID toko di sisi marketplace, biasanya angka.", "The store's ID on the marketplace side, usually a number.")}
                        >
                          <input
                            name="shopIdApi"
                            defaultValue={s.shopIdApi ?? ""}
                            placeholder="ex: 1029384756"
                            className={inputClass}
                          />
                        </Field>
                        <div className="flex items-center">
                          <Checkbox
                            name="isActive"
                            defaultChecked={s.isActive}
                            label={t("Toko aktif (ikut sync)", "Store active (included in sync)")}
                          />
                        </div>
                        <div className="sm:col-span-2 sm:flex sm:justify-end">
                          <SubmitButton variant="outline" pendingText={t("Menyimpan…", "Saving…")}>
                            {t("Simpan Kredensial", "Save Credentials")}
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
