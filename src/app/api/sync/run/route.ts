import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncAllStores } from "@/lib/syncAll";
import { syncShopeeStore } from "@/lib/shopee/sync";
import { syncTiktokStore } from "@/lib/tiktok/sync";
import { startSyncJob, progressWriter, finishSyncJob, type ProgressFn } from "@/lib/syncProgress";

export const dynamic = "force-dynamic";
// Satu putaran sync dibatasi ~45 detik di dalam; kasih headroom sampai batas Vercel.
export const maxDuration = 60;

// Jalankan SATU putaran sync (semua toko / satu toko) lalu balikin hasilnya JSON.
//
// Sengaja route handler + fetch, BUKAN Server Action: server action dijalankan
// React di dalam transition, jadi navigasi antar halaman ikut ngantri sampai
// sync selesai (aplikasi terasa beku ~45 detik). Dengan fetch, user bebas
// pindah halaman; progresnya tetap kebaca lewat tabel SyncJob (/api/sync/progress).
//
// Kalau `partial` true berarti waktu habis dan masih ada sisa → klien memanggil
// lagi (putaran berikutnya). Progres tiap batch sudah tersimpan.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    scope?: "all" | "store";
    storeId?: string;
    days?: number;
    round?: number;
    accCreated?: number;
    accUpdated?: number;
  };

  const int = (v: unknown, def = 0) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : def;
  };

  try {
    // ---- semua toko sekaligus (job progresnya dibuat di syncAllStores) ----
    if (body.scope === "all") {
      const r = await syncAllStores(90);
      revalidatePath("/master/toko");
      revalidatePath("/pembukuan");
      revalidatePath("/");
      return NextResponse.json({
        created: r.created,
        updated: r.updated,
        partial: r.partial,
        stores: r.stores,
        errors: r.errors,
      });
    }

    // ---- satu toko ----
    const storeId = String(body.storeId ?? "");
    if (!storeId) return NextResponse.json({ error: "storeId kosong" }, { status: 400 });

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true, marketplace: true },
    });
    if (!store) return NextResponse.json({ error: "Toko tidak ditemukan" }, { status: 404 });

    const days = Math.min(1095, Math.max(1, int(body.days, 90) || 90));
    const round = Math.max(1, int(body.round, 1) || 1);
    const accCreated = int(body.accCreated);
    const accUpdated = int(body.accUpdated);

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - days);

    const jobId = await startSyncJob({ storeId, storeName: store.name, scope: "STORE" });
    const progress = progressWriter(jobId);

    try {
      // angka progres dilanjutkan dari putaran sebelumnya biar tidak mundur
      const onProgress: ProgressFn = async (p) =>
        progress({
          ...p,
          ...(p.created != null ? { created: accCreated + p.created } : {}),
          ...(p.updated != null ? { updated: accUpdated + p.updated } : {}),
          message: p.message ? (round > 1 ? `Putaran ${round} — ${p.message}` : p.message) : undefined,
        });

      const r =
        store.marketplace === "SHOPEE"
          ? await syncShopeeStore(storeId, from, to, { onProgress })
          : { ...(await syncTiktokStore(storeId, from, to, { onProgress })), partial: false };

      const created = accCreated + r.created;
      const updated = accUpdated + r.updated;

      await finishSyncJob(jobId, {
        phase: "done",
        created,
        updated,
        partial: r.partial,
        message: r.partial
          ? `Putaran ${round} selesai: ${created} baru, ${updated} diperbarui — masih ada sisa`
          : `Selesai: ${created} baru, ${updated} diperbarui`,
      });

      revalidatePath("/master/toko");
      revalidatePath("/pembukuan");
      revalidatePath("/");
      return NextResponse.json({ created, updated, partial: r.partial });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await finishSyncJob(jobId, { phase: "error", error: msg, message: `Gagal: ${msg}` });
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
