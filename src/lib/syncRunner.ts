import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncAllStores } from "@/lib/syncAll";
import { syncShopeeStore } from "@/lib/shopee/sync";
import { syncTiktokStore } from "@/lib/tiktok/sync";
import { startSyncJob, progressWriter, finishSyncJob, type ProgressFn } from "@/lib/syncProgress";

// Satu PUTARAN sync (≈45 detik kerja) + cara melanjutkannya.
//
// Toko besar butuh banyak putaran. Menyambung dengan cara deployment memanggil
// URL-nya sendiri TIDAK BISA di Vercel: request balik ke deployment yang sama
// ditolak dengan HTTP 508 (Loop Detected).
//
// Jadi sisa pekerjaan DITITIPKAN ke database: putaran yang berhenti karena waktu
// habis menyimpan posisi terakhirnya (round + days + hitungan) di SyncJob dengan
// partial=true. Yang melanjutkan:
//   • browser (kalau halaman masih dibuka) — paling cepat, dan
//   • /api/cron/sync-resume — dipanggil penjadwal LUAR (cron-job.org/UptimeRobot,
//     yang sama untuk keep-warm) atau cron harian Vercel → jalan walau tab ditutup.

export const MAX_ROUNDS = 80; // ±1 jam kerja — pengaman dari loop tak berujung

export type RoundInput = {
  scope: "all" | "store";
  storeId?: string;
  days?: number;
  round: number;
  accCreated: number;
  accUpdated: number;
};

export type RoundResult = {
  created: number;
  updated: number;
  partial: boolean;
  stores?: number;
  errors?: { store: string; message: string }[];
};

const int = (v: unknown, def = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : def;
};

export function parseRoundInput(body: Record<string, unknown>): RoundInput {
  return {
    scope: body.scope === "all" ? "all" : "store",
    storeId: body.storeId ? String(body.storeId) : undefined,
    days: Math.min(1095, Math.max(1, int(body.days, 90) || 90)),
    round: Math.max(1, int(body.round, 1) || 1),
    accCreated: int(body.accCreated),
    accUpdated: int(body.accUpdated),
  };
}

// budgetMs: sisa waktu yang boleh dipakai (default 45 detik, cukup untuk 1 panggilan)
export async function runSyncRound(input: RoundInput, budgetMs = 45_000): Promise<RoundResult> {
  const days = input.days ?? 90;
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  // ---- semua toko sekaligus (job progresnya dibuat di syncAllStores) ----
  if (input.scope === "all") {
    const r = await syncAllStores(days, budgetMs);
    revalidatePath("/master/toko");
    revalidatePath("/pembukuan");
    revalidatePath("/");
    return {
      created: r.created,
      updated: r.updated,
      partial: r.partial,
      stores: r.stores,
      errors: r.errors,
    };
  }

  // ---- satu toko ----
  const storeId = String(input.storeId ?? "");
  if (!storeId) throw new Error("storeId kosong");

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, marketplace: true },
  });
  if (!store) throw new Error("Toko tidak ditemukan");

  const { round, accCreated, accUpdated } = input;
  const jobId = await startSyncJob({
    storeId,
    storeName: store.name,
    scope: "STORE",
    round,
    days,
  });
  const progress = progressWriter(jobId);

  try {
    // angka progres dilanjutkan dari putaran sebelumnya biar tidak mundur
    const onProgress: ProgressFn = async (p) =>
      progress({
        ...p,
        ...(p.created != null ? { created: accCreated + p.created } : {}),
        ...(p.updated != null ? { updated: accUpdated + p.updated } : {}),
        message: p.message, // nomor putaran sudah tampil di judul kartu
      });

    const r =
      store.marketplace === "SHOPEE"
        ? await syncShopeeStore(storeId, from, to, { onProgress, resume: round > 1, deadlineMs: budgetMs })
        : { ...(await syncTiktokStore(storeId, from, to, { onProgress })), partial: false };

    const created = accCreated + r.created;
    const updated = accUpdated + r.updated;

    // masih ada sisa → job ini jadi penanda pekerjaan yang bisa dilanjutkan
    const willContinue = r.partial && round < MAX_ROUNDS;
    await finishSyncJob(jobId, {
      phase: "done",
      created,
      updated,
      partial: r.partial,
      message: !r.partial
        ? `Selesai: ${created} baru, ${updated} diperbarui`
        : willContinue
          ? `Putaran ${round} selesai: ${created} baru, ${updated} diperbarui. Sisanya dilanjutkan otomatis`
          : `Putaran ${round} selesai: ${created} baru, ${updated} diperbarui. Sudah ${MAX_ROUNDS} putaran, klik Sync lagi kalau masih ada sisa`,
    });

    revalidatePath("/master/toko");
    revalidatePath("/pembukuan");
    revalidatePath("/");
    return { created, updated, partial: r.partial };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await finishSyncJob(jobId, { phase: "error", error: msg, message: `Gagal: ${msg}` });
    throw e;
  }
}

// Cari pekerjaan sync yang masih menyisakan sisa dan belum dilanjutkan.
// Yang dianggap tertunda: job terakhir sebuah toko selesai dengan partial=true.
export async function findPendingRound(): Promise<RoundInput | null> {
  // scope ALL ikut dilanjutkan; dulu cuma STORE, jadi "Sync semua toko" yang
  // kepotong waktu tidak pernah disambung dan menggantung selamanya
  const last = await prisma.syncJob.findFirst({
    where: { partial: true, phase: "done", scope: { not: "DAILY" } },
    orderBy: { finishedAt: "desc" },
  });
  if (!last) return null;
  if (last.round >= MAX_ROUNDS) return null;
  const isAll = last.scope === "ALL";
  if (!isAll && !last.storeId) return null;

  // sudah ada job yang LEBIH BARU untuk pekerjaan yang sama → sudah dilanjutkan
  const newer = await prisma.syncJob.findFirst({
    where: {
      ...(isAll ? { scope: "ALL" } : { storeId: last.storeId }),
      startedAt: { gt: last.finishedAt ?? last.startedAt },
    },
    select: { id: true },
  });
  if (newer) return null;

  return {
    scope: isAll ? "all" : "store",
    storeId: isAll ? undefined : last.storeId!,
    days: last.days ?? 90,
    round: last.round + 1,
    accCreated: last.created,
    accUpdated: last.updated,
  };
}
