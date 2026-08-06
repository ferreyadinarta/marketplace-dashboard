import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import {
  parseRoundInput,
  runSyncRound,
  chainNextRound,
  canRunInBackground,
} from "@/lib/syncRunner";

export const dynamic = "force-dynamic";
// Satu putaran sync dibatasi ~45 detik di dalam; kasih headroom sampai batas Vercel.
export const maxDuration = 60;

// Jalankan SATU putaran sync (semua toko / satu toko) lalu balikin hasilnya JSON.
//
// Sengaja route handler + fetch, BUKAN Server Action: server action dijalankan
// React di dalam transition, jadi navigasi antar halaman ikut ngantri sampai
// sync selesai (aplikasi terasa beku ~45 detik). Dengan fetch, user bebas
// pindah halaman; progresnya tetap kebaca lewat tabel SyncJob.
//
// Kalau masih ada sisa (partial), putaran berikutnya DIJADWALKAN DI SERVER
// lewat after() → halaman boleh ditutup, sync tetap lanjut sampai selesai.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseRoundInput(body);

  try {
    const result = await runSyncRound(input);
    const background = result.partial && canRunInBackground();

    // dijalankan SETELAH response terkirim, jadi user tidak menunggu
    if (background) after(() => chainNextRound(input, req.url, result));

    return NextResponse.json({ ...result, background });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
