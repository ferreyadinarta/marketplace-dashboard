import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { findPendingRound, runSyncRound } from "@/lib/syncRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lanjutkan sync yang masih menyisakan pekerjaan — SATU putaran per panggilan.
//
// Dipanggil penjadwal LUAR (cron-job.org / UptimeRobot) tiap >=15 menit.
// Jangan di bawah 5 menit: tiap panggilan query DB, compute Neon jadi tidak pernah tidur. Kenapa dari luar? Karena
// Vercel menolak deployment yang memanggil URL-nya sendiri (HTTP 508 Loop
// Detected), jadi server tidak bisa menyambung putarannya sendiri.
//
// Aman dipanggil sesering apa pun: kalau tidak ada sisa, dia langsung balik
// tanpa menyentuh API marketplace.
//
// Responsnya SELALU cepat: satu putaran butuh ~45 detik, sedangkan layanan cron
// gratis biasanya putus di 30 detik dan menandai job-nya gagal (kalau gagal
// terus, job-nya bisa dinonaktifkan otomatis). Jadi pekerjaannya dijalankan
// lewat after() — setelah response terkirim, masih di invocation yang sama.
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

    // jalankan SETELAH response terkirim → pemanggil tidak kena timeout
    after(async () => {
      try {
        await runSyncRound(pending);
      } catch (e) {
        // kegagalan sudah tercatat sebagai SyncJob error di runSyncRound
        console.error("sync-resume gagal:", e);
      }
    });

    return NextResponse.json({
      ok: true,
      idle: false,
      started: true,
      storeId: pending.storeId,
      round: pending.round,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = handle; // uptime pinger biasanya cuma bisa GET
export const POST = handle;
