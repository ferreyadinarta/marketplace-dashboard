import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { parseRoundInput, runSyncRound, chainNextRound } from "@/lib/syncRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Penerus sync di LATAR BELAKANG. Dipanggil oleh server sendiri (bukan browser)
// untuk putaran ke-2 dan seterusnya, lalu menjadwalkan putaran berikutnya lagi
// sampai tidak ada sisa atau batas putaran tercapai.
//
// Ada di bawah /api/cron/ supaya lolos gate sesi login (lihat proxy.ts) — tapi
// tetap wajib membawa CRON_SECRET, jadi bukan endpoint terbuka.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET belum di-set" }, { status: 400 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseRoundInput(body);

  try {
    const result = await runSyncRound(input);
    if (result.partial) after(() => chainNextRound(input, req.url, result));
    return NextResponse.json({ ...result, round: input.round });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
