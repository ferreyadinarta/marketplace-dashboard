import { prisma } from "@/lib/prisma";
import { syncTiktokStore } from "@/lib/tiktok/sync";
import { syncShopeeStore } from "@/lib/shopee/sync";

export type SyncAllResult = {
  stores: number; // jumlah toko yang berhasil di-sync
  created: number;
  updated: number;
  errors: { store: string; message: string }[];
};

// Sync SEMUA toko OAuth yang aktif & sudah terhubung (TikTok + Shopee).
// Dipakai oleh cron (otomatis terjadwal) & tombol "Sync semua toko" (manual).
// Kalau satu toko gagal, toko lain tetap jalan — errornya dikumpulkan.
export async function syncAllStores(days = 30): Promise<SyncAllResult> {
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

  const res: SyncAllResult = { stores: 0, created: 0, updated: 0, errors: [] };

  for (const s of stores) {
    try {
      const r =
        s.marketplace === "SHOPEE"
          ? await syncShopeeStore(s.id, from, to)
          : await syncTiktokStore(s.id, from, to);
      res.stores++;
      res.created += r.created;
      res.updated += r.updated;
    } catch (e) {
      res.errors.push({ store: s.name, message: e instanceof Error ? e.message : "unknown" });
    }
  }

  return res;
}
