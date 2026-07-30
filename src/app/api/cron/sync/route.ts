import { NextRequest, NextResponse } from "next/server";
import { syncAllStores } from "@/lib/syncAll";

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
    const r = await syncAllStores(30);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
