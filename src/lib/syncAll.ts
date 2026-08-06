import { prisma } from "@/lib/prisma";
import { syncTiktokStore } from "@/lib/tiktok/sync";
import { syncShopeeStore } from "@/lib/shopee/sync";

export type SyncAllResult = {
  stores: number; // jumlah toko yang berhasil di-sync
  created: number;
  updated: number;
  partial: boolean; // true = waktu habis, masih ada sisa (jalankan lagi)
  errors: { store: string; message: string }[];
};

// Sync SEMUA toko OAuth yang aktif & sudah terhubung (TikTok + Shopee).
// Dipakai oleh cron (otomatis terjadwal) & tombol "Sync semua toko" (manual).
// Kalau satu toko gagal, toko lain tetap jalan — errornya dikumpulkan.
//
// Semua toko berbagi SATU jatah waktu function (Vercel Hobby maks 60 detik),
// jadi bagi sisa waktu ke tiap toko dan berhenti rapi kalau habis — progres
// tiap batch sudah tersimpan, sisanya lanjut di pemanggilan berikutnya.
export async function syncAllStores(days = 30, budgetMs = 45_000): Promise<SyncAllResult> {
  const started = Date.now();
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  const stores = await prisma.store.findMany({
    where: {
      isActive: true,
      accessToken: { not: null },
      marketplace: { in: ["TIKTOK", "SHOPEE"] },
    },
  });

  const res: SyncAllResult = { stores: 0, created: 0, updated: 0, partial: false, errors: [] };

  for (const [i, s] of stores.entries()) {
    const left = budgetMs - (Date.now() - started);
    if (left <= 2_000) {
      res.partial = true;
      break;
    }
    // bagi rata sisa waktu ke toko yang belum dikerjakan
    const share = Math.max(5_000, Math.floor(left / Math.max(1, stores.length - i)));

    try {
      if (s.marketplace === "SHOPEE") {
        const r = await syncShopeeStore(s.id, from, to, { deadlineMs: share });
        res.created += r.created;
        res.updated += r.updated;
        if (r.partial) res.partial = true;
      } else {
        const r = await syncTiktokStore(s.id, from, to);
        res.created += r.created;
        res.updated += r.updated;
      }
      res.stores++;
    } catch (e) {
      res.errors.push({ store: s.name, message: e instanceof Error ? e.message : "unknown" });
    }
  }

  return res;
}
