import { NextResponse, type NextRequest } from "next/server";
import { parseRoundInput, runSyncRound } from "@/lib/syncRunner";

export const dynamic = "force-dynamic";
// Satu putaran sync dibatasi ~45 detik di dalam; kasih headroom sampai batas Vercel.
export const maxDuration = 60;

// Jalankan SATU putaran sync (semua toko / satu toko) lalu balikin hasilnya JSON.
//
// Route handler + fetch, BUKAN Server Action: server action jalan di dalam
// transition React, jadi navigasi antar halaman ikut ngantri sampai sync selesai
// (aplikasi terasa beku ~45 detik).
//
// Kalau `partial` true berarti waktu habis dan masih ada sisa. Sisanya dilanjutkan
// oleh browser (selama halaman terbuka) ATAU /api/cron/sync-resume yang dipanggil
// penjadwal luar — posisinya sudah tersimpan di SyncJob.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseRoundInput(body);

  try {
    const result = await runSyncRound(input);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
