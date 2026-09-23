import { NextRequest, NextResponse } from "next/server";
import { syncAllStores } from "@/lib/syncAll";
import { notifyLowStock } from "@/lib/lowStock";
import { findPendingRound, runSyncRound } from "@/lib/syncRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // beri waktu lebih untuk beberapa toko sekaligus

// Auto-sync terjadwal (dipanggil Vercel Cron). Loop semua toko OAuth aktif.
// Vercel Cron otomatis mengirim header "Authorization: Bearer <CRON_SECRET>"
// kalau env CRON_SECRET di-set → kita tolak request yang tidak cocok.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    // 1) SELALU segarkan status 30 hari terakhir dulu. Dulu kalau ada sync
    //    riwayat yang menggantung, cron cuma melanjutkan itu dan melewatkan
    //    penyegaran → status pesanan (Selesai/Batal) bisa macet berhari-hari.
    // 2) Sisa waktunya baru dipakai melanjutkan sync riwayat yang tertunda.
    //    Batas Vercel 60 detik → total kerja dijaga ≤ ~50 detik.
    const started = Date.now();
    const pending = await findPendingRound();
    const daily = await syncAllStores(30, pending ? 25_000 : 45_000, { daily: true });

    const left = 50_000 - (Date.now() - started);
    const history =
      pending && left >= 10_000 ? await runSyncRound(pending, left - 3_000) : null;

    const r = {
      stores: daily.stores,
      created: daily.created + (history?.created ?? 0),
      updated: daily.updated + (history?.updated ?? 0),
      partial: daily.partial,
      errors: daily.errors,
      history: pending ? (history ? { partial: history.partial } : { skipped: "no time left" }) : undefined,
    };
    // setelah sync, cek stok menipis → kirim notifikasi (edge-triggered).
    // jangan gagalkan cron kalau notif error.
    let notif = { sent: 0, failed: 0, fresh: 0 };
    try {
      notif = await notifyLowStock();
    } catch (e) {
      console.error("notifyLowStock gagal:", e);
    }
    return NextResponse.json({ ok: true, ...r, notif });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
