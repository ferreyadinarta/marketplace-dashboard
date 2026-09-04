import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Health check. DEFAULT-nya TIDAK menyentuh DB.
//
// Dulu route ini selalu `SELECT 1` dan dipanggil scheduler luar tiap ~4 menit
// sebagai keep-warm, supaya compute Neon (auto-suspend tiap 5 menit idle) tidak
// tidur. Efek sampingnya: compute TIDAK PERNAH tidur → 730 jam/bulan × 0.25 CU
// ≈ 182 CU-jam, sedangkan plan Free cuma 100 CU-jam. Kuota habis ~16 hari
// walau aplikasinya nganggur. Cold start ~470ms tidak sepadan dengan itu.
//
// Sekarang: ping polos = cek server hidup saja (Vercel tetap hangat, Neon boleh
// tidur). Pakai ?db=1 kalau memang mau ikut mengecek koneksi DB — jangan
// dipasang di scheduler yang jalan tiap beberapa menit.
export async function GET(req: NextRequest) {
  const t = Date.now();
  if (req.nextUrl.searchParams.get("db") !== "1") {
    return NextResponse.json({ ok: true, db: false });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true, ms: Date.now() - t });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
