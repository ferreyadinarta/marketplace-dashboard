import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncAllStores } from "@/lib/syncAll";
import { syncShopeeStore } from "@/lib/shopee/sync";
import { syncTiktokStore } from "@/lib/tiktok/sync";
import { startSyncJob, progressWriter, finishSyncJob, type ProgressFn } from "@/lib/syncProgress";

// Satu PUTARAN sync (≈45 detik kerja) + kemampuan menyambung sendiri.
//
// Toko besar butuh banyak putaran. Sebelumnya penyambungnya ada di browser, jadi
// menutup tab = sync berhenti. Sekarang server yang memanggil dirinya sendiri
// untuk putaran berikutnya (lewat /api/cron/sync-run yang dijaga CRON_SECRET),
// sehingga user boleh menutup halaman dan sync tetap jalan sampai selesai.

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

export async function runSyncRound(input: RoundInput): Promise<RoundResult> {
  const days = input.days ?? 90;
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  // ---- semua toko sekaligus (job progresnya dibuat di syncAllStores) ----
  if (input.scope === "all") {
    const r = await syncAllStores(days);
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

    // pesan harus jujur: "lanjut sendiri" hanya kalau server memang bisa
    // menyambung (butuh CRON_SECRET) dan belum kena batas putaran
    const willContinue = r.partial && canRunInBackground() && round < MAX_ROUNDS;
    await finishSyncJob(jobId, {
      phase: "done",
      created,
      updated,
      partial: r.partial,
      message: !r.partial
        ? `Selesai: ${created} baru, ${updated} diperbarui`
        : willContinue
          ? `Putaran ${round} selesai: ${created} baru, ${updated} diperbarui — lanjut otomatis ke putaran ${round + 1}`
          : `Putaran ${round} selesai: ${created} baru, ${updated} diperbarui — klik Sync lagi untuk melanjutkan`,
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

// Alamat untuk memanggil putaran berikutnya.
// Pakai origin REQUEST dulu (domain yang benar-benar dibuka user), baru env.
// VERCEL_URL menunjuk ke URL deployment, yang bisa kena Deployment Protection
// dan menolak panggilan server-ke-server — alias domainnya lebih aman.
function selfOrigin(reqUrl: string): string {
  try {
    return new URL(reqUrl).origin;
  } catch {
    return process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  }
}

// Bisa lanjut sendiri hanya kalau ada CRON_SECRET (dipakai menandatangani
// panggilan internal). Tanpa itu, klien yang harus melanjutkan seperti dulu.
export function canRunInBackground(): boolean {
  return !!process.env.CRON_SECRET;
}

// Jadwalkan putaran berikutnya di SERVER. Dipanggil lewat `after()` supaya
// dijalankan setelah response terkirim — user tidak menunggu.
export async function chainNextRound(input: RoundInput, reqUrl: string, result: RoundResult) {
  if (!result.partial) return;
  if (input.round >= MAX_ROUNDS) return;
  if (!canRunInBackground()) return;

  const next: RoundInput = {
    ...input,
    round: input.round + 1,
    accCreated: result.created,
    accUpdated: result.updated,
  };

  try {
    await fetch(`${selfOrigin(reqUrl)}/api/cron/sync-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify(next),
    });
  } catch (e) {
    // putaran berikutnya gagal dijadwalkan → progres yang sudah ada tetap aman,
    // user bisa klik Sync lagi untuk melanjutkan
    console.error("chainNextRound gagal:", e);
  }
}
