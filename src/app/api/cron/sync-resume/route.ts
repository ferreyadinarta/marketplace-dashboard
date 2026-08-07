import { NextResponse, type NextRequest } from "next/server";
import { findPendingRound, runSyncRound } from "@/lib/syncRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lanjutkan sync yang masih menyisakan pekerjaan — SATU putaran per panggilan.
//
// Dipanggil penjadwal LUAR (cron-job.org / UptimeRobot, penjadwal yang sama
// dengan keep-warm /api/health) tiap beberapa menit. Kenapa dari luar? Karena
// Vercel menolak deployment yang memanggil URL-nya sendiri (HTTP 508 Loop
// Detected), jadi server tidak bisa menyambung putarannya sendiri.
//
// Aman dipanggil sesering apa pun: kalau tidak ada sisa, dia langsung balik
// tanpa menyentuh API marketplace.
//
// Auth: CRON_SECRET lewat header Authorization ATAU query ?key= (banyak layanan
// uptime gratis tidak bisa mengirim header).
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const pending = await findPendingRound();
    if (!pending) return NextResponse.json({ ok: true, idle: true });

    const r = await runSyncRound(pending);
    return NextResponse.json({
      ok: true,
      idle: false,
      storeId: pending.storeId,
      round: pending.round,
      created: r.created,
      updated: r.updated,
      partial: r.partial,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = handle; // uptime pinger biasanya cuma bisa GET
export const POST = handle;
