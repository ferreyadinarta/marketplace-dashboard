import { prisma } from "@/lib/prisma";
import { tanggal, MARKETPLACE_LABEL } from "@/lib/format";
import { createStore, updateStoreCredentials, deleteStore } from "./actions";

export const dynamic = "force-dynamic";

export default async function MasterTokoPage() {
  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master Toko</h1>
        <p className="text-sm text-slate-500">Daftar toko & kredensial API tiap marketplace.</p>
      </div>

      <form action={createStore} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-xs font-medium text-slate-500">Nama toko</label>
          <input name="name" required className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Marketplace</label>
          <select name="marketplace" className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="SHOPEE">Shopee</option>
            <option value="TIKTOK">TikTok Shop</option>
            <option value="TOKOPEDIA">Tokopedia</option>
          </select>
        </div>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Tambah Toko
        </button>
      </form>

      <div className="space-y-4">
        {stores.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{s.name}</h2>
                <p className="text-xs text-slate-500">
                  {MARKETPLACE_LABEL[s.marketplace] ?? s.marketplace}
                  {" · "}
                  {s.lastSyncAt ? `Sync terakhir: ${tanggal(s.lastSyncAt)}` : "Belum pernah sync"}
                </p>
              </div>
              <form action={deleteStore}>
                <input type="hidden" name="id" value={s.id} />
                <button className="text-xs text-red-500 hover:underline">Hapus toko</button>
              </form>
            </div>
            <form action={updateStoreCredentials} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={s.id} />
              <input name="apiKey" defaultValue={s.apiKey ?? ""} placeholder="API Key" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="apiSecret" defaultValue={s.apiSecret ?? ""} placeholder="API Secret" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="shopIdApi" defaultValue={s.shopIdApi ?? ""} placeholder="Shop ID (dari marketplace)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="isActive" defaultChecked={s.isActive} /> Aktif
              </label>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 sm:col-start-3">
                Simpan Kredensial
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
