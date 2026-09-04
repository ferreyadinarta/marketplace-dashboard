import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Ping polos tidak menyentuh DB — kalau tiap ping query, compute Neon tidak
// pernah auto-suspend dan kuota Free (100 CU-jam) habis di tengah bulan.
// ?db=1 untuk ikut cek koneksi DB; jangan dipakai di scheduler.
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
