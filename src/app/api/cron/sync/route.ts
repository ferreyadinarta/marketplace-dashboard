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
    // Kalau masih ada sisa sync yang belum kelar (tarik riwayat panjang), itu
    // yang didahulukan — percuma menarik 30 hari terakhir berulang kali sementara
    // pekerjaan lama menggantung.
    const pending = await findPendingRound();
    const r = pending
      ? { ...(await runSyncRound(pending)), stores: 1, errors: [] as { store: string; message: string }[] }
      : await syncAllStores(30);
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
