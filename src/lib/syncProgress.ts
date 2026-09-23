import { prisma } from "@/lib/prisma";

// Checkpoint progres sync ke DB supaya UI bisa nengok "lagi ngapain".
// Ditulis dari dalam loop sync (tiap batch order), dibaca lewat polling
// /api/sync/progress. Sengaja lewat DB, bukan memory: di Vercel tiap request
// bisa jatuh di instance berbeda, dan cron juga jalan tanpa UI.

export type ProgressPatch = {
  phase?: string;
  storeIndex?: number;
  storeTotal?: number;
  windowIndex?: number;
  windowTotal?: number;
  ordersDone?: number;
  ordersTotal?: number;
  created?: number;
  updated?: number;
  partial?: boolean;
  message?: string;
  storeName?: string;
  storeId?: string | null;
};

// Fungsi yang dioper ke sync per toko. Tulis sesering yang masuk akal —
// throttle-nya diurus di sini, jadi pemanggil tidak perlu mikir.
export type ProgressFn = (p: ProgressPatch) => Promise<void>;

const MIN_INTERVAL_MS = 1_200; // jangan spam DB tiap iterasi kecil

export async function startSyncJob(input: {
  storeId?: string | null;
  storeName: string;
  // DAILY = penyegaran status 30 hari dari cron: tampil seperti ALL, tapi tidak
  // pernah dianggap pekerjaan tertunda (lihat findPendingRound)
  scope: "ALL" | "STORE" | "DAILY";
  storeTotal?: number;
  round?: number; // putaran ke berapa (untuk melanjutkan pekerjaan)
  days?: number; // rentang hari yang diminta user
}): Promise<string> {
  // sapu riwayat lama biar tabel tidak menumpuk (job cuma untuk tampilan)
  try {
    await prisma.syncJob.deleteMany({
      where: { startedAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    });
  } catch {
    /* abaikan */
  }

  const job = await prisma.syncJob.create({
    data: {
      storeId: input.storeId ?? null,
      storeName: input.storeName,
      scope: input.scope,
      phase: "queued",
      storeTotal: input.storeTotal ?? 1,
      round: input.round ?? 1,
      days: input.days ?? null,
      message: "Menyiapkan…",
    },
    select: { id: true },
  });
  return job.id;
}

// Bikin writer ber-throttle untuk satu job. `force` dipakai di titik penting
// (mulai toko baru, selesai) supaya tidak ketelan throttle.
export function progressWriter(jobId: string): ProgressFn & { flush: ProgressFn } {
  let last = 0;
  let queued: ProgressPatch = {};

  const write = async (patch: ProgressPatch) => {
    try {
      await prisma.syncJob.update({ where: { id: jobId }, data: patch });
    } catch {
      // progres cuma kosmetik — jangan sampai bikin sync gagal
    }
  };

  const fn = (async (patch: ProgressPatch) => {
    queued = { ...queued, ...patch };
    const now = Date.now();
    if (now - last < MIN_INTERVAL_MS) return;
    last = now;
    const p = queued;
    queued = {};
    await write(p);
  }) as ProgressFn & { flush: ProgressFn };

  fn.flush = async (patch: ProgressPatch) => {
    const p = { ...queued, ...patch };
    queued = {};
    last = Date.now();
    await write(p);
  };

  return fn;
}

export async function finishSyncJob(
  jobId: string,
  data: { phase: "done" | "error"; created?: number; updated?: number; partial?: boolean; error?: string; message?: string }
) {
  try {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { ...data, finishedAt: new Date() },
    });
  } catch {
    /* abaikan */
  }
}

// Job yang layak ditampilkan: masih jalan, atau baru saja selesai (biar user
// sempat lihat hasilnya sebelum hilang).
export const ACTIVE_STALE_MS = 3 * 60 * 1000; // tak ada update 3 menit → dianggap mati
// Job selesai tetap ditampilkan beberapa menit: kalau putaran berikutnya
// gagal dijadwalkan, user masih melihat statusnya (bukan panel yang hilang
// begitu saja tanpa penjelasan).
export const RECENT_DONE_MS = 3 * 60 * 1000;
// Pekerjaan yang BELUM tuntas (partial) tetap ditampilkan jauh lebih lama:
// penerusnya berjalan tiap ~5 menit, jadi kalau kartunya hilang setelah 3 menit
// user melihat panel kosong padahal sync-nya masih akan lanjut.
export const PENDING_MS = 24 * 60 * 60 * 1000;

export async function listSyncJobs() {
  const now = Date.now();
  const rows = await prisma.syncJob.findMany({
    where: {
      OR: [
        { finishedAt: null, updatedAt: { gt: new Date(now - ACTIVE_STALE_MS) } },
        { finishedAt: { gt: new Date(now - RECENT_DONE_MS) } },
        // masih ada sisa & menunggu putaran berikutnya
        { partial: true, phase: "done", finishedAt: { gt: new Date(now - PENDING_MS) } },
      ],
    },
    orderBy: { startedAt: "desc" },
    take: 40,
  });

  if (rows.length === 0) return [];

  // Ambil job TERBARU tiap toko tanpa batas waktu. Job partial disimpan 24 jam,
  // job yang tuntas cuma 3 menit — tanpa langkah ini, begitu kartu "selesai"
  // lewat 3 menit, yang tersisa justru putaran partial LAMA dan panel bilang
  // "menunggu lanjutan" seharian padahal sync-nya sudah beres.
  const newest = await prisma.syncJob.findMany({
    where: { OR: rows.map((r) => ({ scope: r.scope, storeId: r.storeId })) },
    orderBy: { startedAt: "desc" },
    distinct: ["scope", "storeId"],
  });

  const layak = newest.filter(
    (j) =>
      !j.finishedAt || // masih jalan
      (j.partial && j.phase === "done") || // nunggu lanjutan
      j.finishedAt.getTime() > now - RECENT_DONE_MS // baru saja tuntas / error
  );

  return layak.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}
